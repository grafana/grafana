import { css } from '@emotion/css';
import { autoUpdate, useFloating } from '@floating-ui/react';
import { groupBy } from 'lodash';
import { type FormEvent, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as React from 'react';

import { type GrafanaTheme2, type VariableSuggestion } from '@grafana/data';
import {
  FieldValidationMessage,
  floatingUtils,
  Input,
  Portal,
  ScrollContainer,
  TextArea,
  useTheme2,
} from '@grafana/ui';
import { DataLinkSuggestions } from '@grafana/ui/internal';

const modulo = (a: number, n: number) => a - n * Math.floor(a / n);
const ERROR_TOOLTIP_OFFSET = 8;

export enum HTMLElementType {
  InputElement = 'input',
  TextAreaElement = 'textarea',
}

interface SuggestionsInputProps {
  value?: string | number;
  onChange: (url: string, callback?: () => void) => void;
  suggestions: VariableSuggestion[];
  placeholder?: string;
  invalid?: boolean;
  error?: string;
  width?: number;
  type?: HTMLElementType;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  /**
   * Called on every edit, before the value is committed through `onChange`. Passing it makes the
   * input controlled: it shows `value`, so the caller has to pass the edited text back.
   */
  onInputChange?: (value: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

const getStyles = (theme: GrafanaTheme2, inputHeight: number) => {
  return {
    suggestionsWrapper: css({
      boxShadow: theme.shadows.z2,
    }),
    errorTooltip: css({
      position: 'absolute',
      top: inputHeight + ERROR_TOOLTIP_OFFSET + 'px',
      zIndex: theme.zIndex.tooltip,
    }),
    inputWrapper: css({
      position: 'relative',
    }),
    // Wrapper with child selector needed.
    // When classnames are applied to the same element as the wrapper, it causes the suggestions to stop working
  };
};

export const SuggestionsInput = ({
  value = '',
  onChange,
  suggestions,
  placeholder,
  error,
  invalid,
  type = HTMLElementType.InputElement,
  style,
  id,
  autoFocus = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  onInputChange,
  inputRef: externalInputRef,
  prefix,
  suffix,
}: SuggestionsInputProps) => {
  const [showingSuggestions, setShowingSuggestions] = useState(false);
  const [suggestionsIndex, setSuggestionsIndex] = useState(0);
  const [ownValue, setOwnValue] = useState<string>(value.toString());
  const variableValue = onInputChange ? value.toString() : ownValue;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [inputHeight, setInputHeight] = useState<number>(0);
  const [startPos, setStartPos] = useState<number>(0);
  // Whether the list was opened by typing `$` at startPos, rather than with Ctrl+Space
  const [startsWithDollar, setStartsWithDollar] = useState(false);
  const [cursorPos, setCursorPos] = useState<number>(0);
  const placement = 'bottom-start';

  const theme = useTheme2();
  const styles = getStyles(theme, inputHeight);

  // What's typed after the `$` narrows the list, so Enter doesn't pick a variable that doesn't match it
  const query = showingSuggestions ? getSuggestionQuery(variableValue, startPos, cursorPos) : '';
  const shownSuggestions = query ? filterSuggestions(suggestions, query) : suggestions;

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null | undefined>(undefined);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollTop);
  }, [scrollTop]);

  // the order of middleware is important!
  const middleware = floatingUtils.getPositioningMiddleware(placement);

  const { refs, floatingStyles } = useFloating({
    open: showingSuggestions,
    placement,
    onOpenChange: setShowingSuggestions,
    middleware,
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const handleRef = useCallback(
    (ref: HTMLInputElement | HTMLTextAreaElement | null) => {
      refs.setReference(ref);

      inputRef.current = ref;
    },
    [refs]
  );

  useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(externalInputRef, () =>
    inputRef.current instanceof HTMLInputElement ? inputRef.current : null
  );

  // Used to get the height of the suggestion elements in order to scroll to them.
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setScrollTop(getElementPosition(activeRef.current, suggestionsIndex));
  }, [suggestionsIndex]);

  const onVariableSelect = React.useCallback(
    (item: VariableSuggestion, input = inputRef.current!) => {
      const curPos = input.selectionStart!;
      const x = input.value;

      const newValue =
        x[startPos - 1] === '$'
          ? x.slice(0, startPos) + item.value + x.slice(curPos)
          : x.slice(0, startPos) + '$' + `{${item.value}}` + x.slice(curPos);

      setOwnValue(newValue);
      onInputChange?.(newValue);
      setShowingSuggestions(false);

      setSuggestionsIndex(0);
      onChange(newValue);
    },
    [onChange, onInputChange, startPos]
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      // A `$` starts a new name even while the list is open, as in `$foo$bar`
      if (event.key === '$' || (!showingSuggestions && event.key === ' ' && event.ctrlKey)) {
        const pos = inputRef.current!.selectionStart || 0;
        setStartPos(pos);
        setStartsWithDollar(event.key === '$');
        setCursorPos(pos);
        setShowingSuggestions(true);
        setSuggestionsIndex(0);
        return;
      }

      if (!showingSuggestions) {
        return;
      }

      // Backspace edits the name, so the list follows the text instead (see onValueChanged)
      switch (event.key) {
        case 'Escape':
          // Only closes the list, not a modal or drawer the input is in
          event.stopPropagation();
          setShowingSuggestions(false);
          return setSuggestionsIndex(0);
        case 'ArrowLeft':
        case 'ArrowRight':
          setShowingSuggestions(false);
          return setSuggestionsIndex(0);

        case 'Enter':
          if (shownSuggestions.length === 0) {
            setShowingSuggestions(false);
            return;
          }
          event.preventDefault();
          return onVariableSelect(shownSuggestions[suggestionsIndex]);

        case 'ArrowDown':
        case 'ArrowUp':
          event.preventDefault();
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          return setSuggestionsIndex((index) => modulo(index + direction, Math.max(shownSuggestions.length, 1)));
        default:
          return;
      }
    },
    [showingSuggestions, shownSuggestions, suggestionsIndex, onVariableSelect]
  );

  const onValueChanged = React.useCallback(
    (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const text = event.currentTarget.value;
      const cursor = event.currentTarget.selectionStart ?? text.length;
      setOwnValue(text);
      setCursorPos(cursor);
      setSuggestionsIndex(0);
      // Picking a suggestion replaces the text from startPos to the cursor, so the list only stays
      // open while that text is still a variable name being typed
      if (showingSuggestions && !isTypingSuggestion(text, startPos, cursor, startsWithDollar)) {
        setShowingSuggestions(false);
      }
      onInputChange?.(text);
    },
    [onInputChange, showingSuggestions, startPos, startsWithDollar]
  );

  const onBlur = React.useCallback(
    (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Clicking a suggestion keeps the focus, so this only runs when focus leaves the input
      setShowingSuggestions(false);
      onChange(event.currentTarget.value);
    },
    [onChange]
  );

  useEffect(() => {
    setInputHeight(inputRef.current!.clientHeight);
  }, []);

  const inputProps = {
    placeholder,
    invalid,
    value: variableValue,
    onChange: onValueChanged,
    onBlur: onBlur,
    onKeyDown: onKeyDown,
    id,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
  };

  return (
    <div className={styles.inputWrapper} style={style ?? {}}>
      {showingSuggestions && shownSuggestions.length > 0 && (
        <Portal>
          {/* Keeps focus in the input while a suggestion is clicked, so its blur doesn't commit the
              half-typed text first */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={styles.suggestionsWrapper}
            onMouseDown={(event) => event.preventDefault()}
          >
            <ScrollContainer
              maxHeight="300px"
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop ?? 0)}
              ref={scrollRef}
            >
              {/* This suggestion component has a specialized name,
                    but is rather generalistic in implementation,
                    so we're using it in transformations also.
                    We should probably rename this to something more general. */}
              <DataLinkSuggestions
                activeRef={activeRef}
                suggestions={shownSuggestions}
                onSuggestionSelect={onVariableSelect}
                onClose={() => setShowingSuggestions(false)}
                activeIndex={suggestionsIndex}
              />
            </ScrollContainer>
          </div>
        </Portal>
      )}
      {invalid && error && (
        <div className={styles.errorTooltip}>
          <FieldValidationMessage>{error}</FieldValidationMessage>
        </div>
      )}
      {type === HTMLElementType.InputElement ? (
        <Input {...inputProps} ref={handleRef} autoFocus={autoFocus} prefix={prefix} suffix={suffix} />
      ) : (
        <TextArea {...inputProps} ref={handleRef} autoFocus={autoFocus} rows={5} />
      )}
    </div>
  );
};

SuggestionsInput.displayName = 'SuggestionsInput';

/**
 * Whether the text from `startPos` to the cursor is still a partial variable name: `$`, an optional
 * `{` and name characters when the list was opened with `$`, or only name characters otherwise
 */
function isTypingSuggestion(text: string, startPos: number, cursorPos: number, startsWithDollar: boolean): boolean {
  const typed = text.slice(startPos, cursorPos);
  return cursorPos >= startPos && (startsWithDollar ? /^\$\{?[\w.]*$/ : /^[\w.]*$/).test(typed);
}

/** The variable name typed between the `$` or `${` at `startPos` and the cursor */
function getSuggestionQuery(text: string, startPos: number, cursorPos: number): string {
  return (
    text
      .slice(startPos, cursorPos)
      .match(/^\$?\{?([\w.]*)/)?.[1]
      .toLowerCase() ?? ''
  );
}

/**
 * The suggestions whose name contains the query: the exact match first, then names that start with
 * it, so Enter on `$min` picks `min` rather than an `admin` listed before it
 */
function filterSuggestions(suggestions: VariableSuggestion[], query: string): VariableSuggestion[] {
  const rank = (name: string) => (name === query ? 0 : name.startsWith(query) ? 1 : 2);
  const ranked = suggestions
    .filter((suggestion) => suggestion.value.toLowerCase().includes(query))
    .sort((a, b) => rank(a.value.toLowerCase()) - rank(b.value.toLowerCase()));
  // DataLinkSuggestions shows the list grouped by origin, in order of first appearance, and the
  // keyboard picks by index, so the list keeps that order: the best match's group comes first
  return Object.values(groupBy(ranked, (suggestion) => suggestion.origin)).flat();
}

function getElementPosition(suggestionElement: HTMLElement | null, activeIndex: number) {
  return (suggestionElement?.clientHeight ?? 0) * activeIndex;
}
