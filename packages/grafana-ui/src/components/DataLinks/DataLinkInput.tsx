import { css, cx } from '@emotion/css';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import Prism, { Grammar, LanguageMap } from 'prismjs';
import { memo, useEffect, useRef, useState } from 'react';
import * as React from 'react';
import { usePrevious } from 'react-use';
import { Value } from 'slate';
import Plain from 'slate-plain-serializer';
import { Editor } from 'slate-react';

import { DataLinkBuiltInVars, GrafanaTheme2, VariableOrigin, VariableSuggestion } from '@grafana/data';

import { SlatePrism } from '../../slate-plugins/slate-prism';
import { useStyles2 } from '../../themes/ThemeContext';
import { SCHEMA, makeValue } from '../../utils/slate';
import { getInputStyles } from '../Input/Input';
import { Portal } from '../Portal/Portal';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';

import { DataLinkSuggestions } from './DataLinkSuggestions';
import { SelectionReference } from './SelectionReference';

const modulo = (a: number, n: number) => a - n * Math.floor(a / n);

interface DataLinkInputProps {
  value: string;
  onChange: (url: string, callback?: () => void) => void;
  suggestions: VariableSuggestion[];
  placeholder?: string;
}

const datalinksSyntax: Grammar = {
  builtInVariable: {
    pattern: /(\${\S+?})/,
  },
};

const plugins = [
  SlatePrism(
    {
      onlyIn: (node) => 'type' in node && node.type === 'code_block',
      getSyntax: () => 'links',
    },
    { ...(Prism.languages as LanguageMap), links: datalinksSyntax }
  ),
];

const getStyles = (theme: GrafanaTheme2) => ({
  input: getInputStyles({ theme, invalid: false }).input,
  editor: css({
    '.token.builtInVariable': {
      color: theme.colors.success.text,
    },
    '.token.variable': {
      color: theme.colors.primary.text,
    },
  }),
  suggestionsWrapper: css({
    boxShadow: theme.shadows.z2,
  }),
  // Wrapper with child selector needed.
  // When classnames are applied to the same element as the wrapper, it causes the suggestions to stop working
  wrapperOverrides: css({
    width: '100%',
    '> .slate-query-field__wrapper': {
      padding: 0,
      backgroundColor: 'transparent',
      border: 'none',
    },
  }),
});

// This memoised also because rerendering the slate editor grabs focus which created problem in some cases this
// was used and changes to different state were propagated here.
export const DataLinkInput = memo(
  ({
    value,
    onChange,
    suggestions,
    placeholder = 'http://your-grafana.com/d/000000010/annotations',
  }: DataLinkInputProps) => {
    const editorRef = useRef<Editor>(null);
    const styles = useStyles2(getStyles);
    const [showingSuggestions, setShowingSuggestions] = useState(false);
    const [suggestionsIndex, setSuggestionsIndex] = useState(0);
    const [linkUrl, setLinkUrl] = useState<Value>(makeValue(value));
    const prevLinkUrl = usePrevious<Value>(linkUrl);
    const [scrollTop, setScrollTop] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      scrollRef.current?.scrollTo(0, scrollTop);
    }, [scrollTop]);

    // the order of middleware is important!
    const middleware = [
      offset(({ rects }) => ({
        alignmentAxis: rects.reference.width,
      })),
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

    // Workaround for https://github.com/ianstormtaylor/slate/issues/2927
    const stateRef = useRef({ showingSuggestions, suggestions, suggestionsIndex, linkUrl, onChange });
    stateRef.current = { showingSuggestions, suggestions, suggestionsIndex, linkUrl, onChange };

    // Used to get the height of the suggestion elements in order to scroll to them.
    const activeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      setScrollTop(getElementPosition(activeRef.current, suggestionsIndex));
    }, [suggestionsIndex]);

    const onKeyDown = React.useCallback((event: React.KeyboardEvent, next: () => void) => {
      if (!stateRef.current.showingSuggestions) {
        if (event.key === '=' || event.key === '$' || (event.keyCode === 32 && event.ctrlKey)) {
          const selectionRef = new SelectionReference();
          refs.setReference(selectionRef);
          return setShowingSuggestions(true);
        }
        return next();
      }

      switch (event.key) {
        case 'Backspace':
          if (stateRef.current.linkUrl.focusText.getText().length === 1) {
            next();
          }
        case 'Escape':
          setShowingSuggestions(false);
          return setSuggestionsIndex(0);

        case 'Enter':
          event.preventDefault();
          return onVariableSelect(stateRef.current.suggestions[stateRef.current.suggestionsIndex]);

        case 'ArrowDown':
        case 'ArrowUp':
          event.preventDefault();
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          return setSuggestionsIndex((index) => modulo(index + direction, stateRef.current.suggestions.length));
        default:
          return next();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      // Update the state of the link in the parent. This is basically done on blur but we need to do it after
      // our state have been updated. The duplicity of state is done for perf reasons and also because local
      // state also contains things like selection and formating.
      if (prevLinkUrl && prevLinkUrl.selection.isFocused && !linkUrl.selection.isFocused) {
        stateRef.current.onChange(Plain.serialize(linkUrl));
      }
    }, [linkUrl, prevLinkUrl]);

    const onUrlChange = React.useCallback(({ value }: { value: Value }) => {
      setLinkUrl(value);
    }, []);

    const onVariableSelect = (item: VariableSuggestion, editor = editorRef.current!) => {
      const precedingChar: string = getCharactersAroundCaret();
      const precedingDollar = precedingChar === '$';
      if (item.origin !== VariableOrigin.Template || item.value === DataLinkBuiltInVars.includeVars) {
        editor.insertText(`${precedingDollar ? '' : '$'}\{${item.value}}`);
      } else {
        editor.insertText(`${precedingDollar ? '' : '$'}\{${item.value}:queryparam}`);
      }

      setLinkUrl(editor.value);
      setShowingSuggestions(false);

      setSuggestionsIndex(0);
      stateRef.current.onChange(Plain.serialize(editor.value));
    };

    const getCharactersAroundCaret = () => {
      const input: HTMLSpanElement | null = document.getElementById('data-link-input')!;
      let precedingChar = '',
        sel: Selection | null,
        range: Range;
      if (window.getSelection) {
        sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          range = sel.getRangeAt(0).cloneRange();
          // Collapse to the start of the range
          range.collapse(true);
          range.setStart(input, 0);
          precedingChar = range.toString().slice(-1);
        }
      }
      return precedingChar;
    };

    return (
      <div className={styles.wrapperOverrides}>
        <div className="slate-query-field__wrapper">
          <div id="data-link-input" className="slate-query-field">
            {showingSuggestions && (
              <Portal>
                <div ref={refs.setFloating} style={floatingStyles}>
                  <ScrollContainer
                    maxHeight="300px"
                    ref={scrollRef}
                    onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
                  >
                    <DataLinkSuggestions
                      activeRef={activeRef}
                      suggestions={stateRef.current.suggestions}
                      onSuggestionSelect={onVariableSelect}
                      onClose={() => setShowingSuggestions(false)}
                      activeIndex={suggestionsIndex}
                    />
                  </ScrollContainer>
                </div>
              </Portal>
            )}
            <Editor
              schema={SCHEMA}
              ref={editorRef}
              placeholder={placeholder}
              value={stateRef.current.linkUrl}
              onChange={onUrlChange}
              onKeyDown={(event, _editor, next) => onKeyDown(event, next)}
              plugins={plugins}
              className={cx(
                styles.editor,
                styles.input,
                css({
                  padding: '3px 8px',
                })
              )}
            />
          </div>
        </div>
      </div>
    );
  }
);

DataLinkInput.displayName = 'DataLinkInput';

function getElementPosition(suggestionElement: HTMLElement | null, activeIndex: number) {
  return (suggestionElement?.clientHeight ?? 0) * activeIndex;
}
