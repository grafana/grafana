import { css, cx } from '@emotion/css';
import Prism, { Grammar, LanguageMap } from 'prismjs';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Popper as ReactPopper } from 'react-popper';
import { usePrevious } from 'react-use';
import { Value } from 'slate';
import Plain from 'slate-plain-serializer';
import { Editor } from 'slate-react';

import { GrafanaTheme2, VariableSuggestion } from '@grafana/data';
import { CustomScrollbar, getInputStyles, makeValue, Portal, SCHEMA, SlatePrism, useStyles2 } from '@grafana/ui';
import { DataLinkSuggestions } from '@grafana/ui/src/components/DataLinks/DataLinkSuggestions';
import { SelectionReference } from '@grafana/ui/src/components/DataLinks/SelectionReference';

const modulo = (a: number, n: number) => a - n * Math.floor(a / n);

interface SuggestionsInputProps {
  className?: string;
  value: string;
  onChange: (url: string, callback?: () => void) => void;
  suggestions: VariableSuggestion[];
  placeholder?: string;
}

const variableSyntax: Grammar = {
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
    { ...(Prism.languages as LanguageMap), links: variableSyntax }
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
export const SuggestionsInput = memo(
  ({ className, value, onChange, suggestions, placeholder }: SuggestionsInputProps) => {
    const editorRef = useRef<Editor>(null);
    const styles = useStyles2(getStyles);
    const [showingSuggestions, setShowingSuggestions] = useState(false);
    const [suggestionsIndex, setSuggestionsIndex] = useState(0);
    const [variableValue, setVariableValue] = useState<Value>(makeValue(String(value)));
    const prevVariableValue = usePrevious<Value>(variableValue);
    const [scrollTop, setScrollTop] = useState(0);

    // Workaround for https://github.com/ianstormtaylor/slate/issues/2927
    const stateRef = useRef({ showingSuggestions, suggestions, suggestionsIndex, variableValue, onChange });
    stateRef.current = { showingSuggestions, suggestions, suggestionsIndex, variableValue, onChange };

    const inputRef = useRef<HTMLDivElement>(null);

    // Used to get the height of the suggestion elements in order to scroll to them.
    const activeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      setScrollTop(getElementPosition(activeRef.current, suggestionsIndex));
    }, [suggestionsIndex]);

    // SelectionReference is used to position the variables suggestion relatively to current DOM selection
    const selectionRef = useMemo(() => new SelectionReference(), []);

    const onKeyDown = React.useCallback((event: React.KeyboardEvent, next: () => void) => {
      if (!stateRef.current.showingSuggestions) {
        if (event.key === '=' || event.key === '$' || (event.keyCode === 32 && event.ctrlKey)) {
          return setShowingSuggestions(true);
        }
        return next();
      }

      switch (event.key) {
        case 'Backspace':
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
      if (prevVariableValue && prevVariableValue.selection.isFocused && !variableValue.selection.isFocused) {
        stateRef.current.onChange(Plain.serialize(variableValue));
      }
    }, [variableValue, prevVariableValue]);

    const onVariableChange = React.useCallback(({ value }: { value: Value }) => {
      setVariableValue(value);
    }, []);

    const onVariableSelect = (item: VariableSuggestion, editor = editorRef.current!) => {
      const precedingChar: string = getCharactersAroundCaret();
      const precedingDollar = precedingChar === '$';
      editor.insertText(`${precedingDollar ? '' : '$'}\{${item.value}}`);

      setVariableValue(editor.value);
      setShowingSuggestions(false);

      setSuggestionsIndex(0);
      stateRef.current.onChange(Plain.serialize(editor.value));
    };

    const getCharactersAroundCaret = () => {
      if (inputRef.current === null) {
        return '';
      }

      let precedingChar = '',
        sel: Selection | null,
        range: Range;
      if (window.getSelection) {
        sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          range = sel.getRangeAt(0).cloneRange();
          // Collapse to the start of the range
          range.collapse(true);
          range.setStart(inputRef.current, 0);
          precedingChar = range.toString().slice(-1);
        }
      }
      return precedingChar;
    };

    return (
      <div className={cx(styles.wrapperOverrides, className)}>
        <div className="slate-query-field__wrapper">
          <div ref={inputRef} className="slate-query-field">
            {showingSuggestions && (
              <Portal>
                <ReactPopper
                  referenceElement={selectionRef}
                  placement="bottom-end"
                  modifiers={[
                    {
                      name: 'preventOverflow',
                      enabled: true,
                      options: {
                        rootBoundary: 'viewport',
                      },
                    },
                    {
                      name: 'arrow',
                      enabled: false,
                    },
                    {
                      name: 'offset',
                      options: {
                        offset: [250, 0],
                      },
                    },
                  ]}
                >
                  {({ ref, style, placement }) => {
                    return (
                      <div ref={ref} style={style} data-placement={placement} className={styles.suggestionsWrapper}>
                        <CustomScrollbar
                          scrollTop={scrollTop}
                          autoHeightMax="300px"
                          setScrollTop={({ scrollTop }) => setScrollTop(scrollTop)}
                        >
                          {/* This suggestion component has a specialized name,
                           but is rather generalistic in implementation,
                           so we're using it in transformations also. 
                           We should probably rename this to something more general. */}
                          <DataLinkSuggestions
                            activeRef={activeRef}
                            suggestions={stateRef.current.suggestions}
                            onSuggestionSelect={onVariableSelect}
                            onClose={() => setShowingSuggestions(false)}
                            activeIndex={suggestionsIndex}
                          />
                        </CustomScrollbar>
                      </div>
                    );
                  }}
                </ReactPopper>
              </Portal>
            )}
            <Editor
              schema={SCHEMA}
              ref={editorRef}
              placeholder={placeholder}
              value={stateRef.current.variableValue}
              onChange={onVariableChange}
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

SuggestionsInput.displayName = 'SuggestionsInput';

function getElementPosition(suggestionElement: HTMLElement | null, activeIndex: number) {
  return (suggestionElement?.clientHeight ?? 0) * activeIndex;
}
