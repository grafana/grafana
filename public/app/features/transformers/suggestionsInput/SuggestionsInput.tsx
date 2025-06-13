import { css } from '@emotion/css';
import { autoUpdate, flip, shift, useFloating } from '@floating-ui/react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2, VariableSuggestion } from '@grafana/data';
import { FieldValidationMessage, Input, Portal, ScrollContainer, TextArea, useTheme2 } from '@grafana/ui';
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
  autoFocus = false,
}: SuggestionsInputProps) => {
  const [showingSuggestions, setShowingSuggestions] = useState(false);
  const [suggestionsIndex, setSuggestionsIndex] = useState(0);
  const [variableValue, setVariableValue] = useState<string>(value.toString());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [inputHeight, setInputHeight] = useState<number>(0);
  const [startPos, setStartPos] = useState<number>(0);

  const theme = useTheme2();
  const styles = getStyles(theme, inputHeight);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>();

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollTop);
  }, [scrollTop]);

  // the order of middleware is important!
  const middleware = [
    flip({
      fallbackAxisSideDirection: 'start',
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
    }),
    shift(),
  ];

  const { refs, floatingStyles } = useFloating({
    open: showingSuggestions,
    placement: 'bottom-start',
    onOpenChange: setShowingSuggestions,
    middleware,
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const handleRef = useCallback(
    (ref: HTMLInputElement | HTMLTextAreaElement) => {
      refs.setReference(ref);

      inputRef.current = ref;
    },
    [refs]
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

      if (x[startPos - 1] === '$') {
        input.value = x.slice(0, startPos) + item.value + x.slice(curPos);
      } else {
        input.value = x.slice(0, startPos) + '$' + `{${item.value}}` + x.slice(curPos);
      }

      setVariableValue(input.value);
      setShowingSuggestions(false);

      setSuggestionsIndex(0);
      onChange(input.value);
    },
    [onChange, startPos]
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (!showingSuggestions) {
        if (event.key === '$' || (event.key === ' ' && event.ctrlKey)) {
          setStartPos(inputRef.current!.selectionStart || 0);
          setShowingSuggestions(true);
          return;
        }
        return;
      }

      switch (event.key) {
        case 'Backspace':
        case 'Escape':
        case 'ArrowLeft':
        case 'ArrowRight':
          setShowingSuggestions(false);
          return setSuggestionsIndex(0);

        case 'Enter':
          event.preventDefault();
          return onVariableSelect(suggestions[suggestionsIndex]);

        case 'ArrowDown':
        case 'ArrowUp':
          event.preventDefault();
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          return setSuggestionsIndex((index) => modulo(index + direction, suggestions.length));
        default:
          return;
      }
    },
    [showingSuggestions, suggestions, suggestionsIndex, onVariableSelect]
  );

  const onValueChanged = React.useCallback((event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setVariableValue(event.currentTarget.value);
  }, []);

  const onBlur = React.useCallback(
    (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
  };

  return (
    <div className={styles.inputWrapper} style={style ?? {}}>
      {showingSuggestions && (
        <Portal>
          <div ref={refs.setFloating} style={floatingStyles} className={styles.suggestionsWrapper}>
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
                suggestions={suggestions}
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
        <Input {...inputProps} ref={handleRef as unknown as React.RefObject<HTMLInputElement>} autoFocus={autoFocus} />
      ) : (
        <TextArea
          {...inputProps}
          ref={handleRef as unknown as React.RefObject<HTMLTextAreaElement>}
          autoFocus={autoFocus}
          rows={5}
        />
      )}
    </div>
  );
};

SuggestionsInput.displayName = 'SuggestionsInput';

function getElementPosition(suggestionElement: HTMLElement | null, activeIndex: number) {
  return (suggestionElement?.clientHeight ?? 0) * activeIndex;
}
