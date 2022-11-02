import { css, cx } from '@emotion/css';
import Prism, { Grammar, LanguageMap } from 'prismjs';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Popper as ReactPopper } from 'react-popper';
import usePrevious from 'react-use/lib/usePrevious';
import { Value } from 'slate';
import Plain from 'slate-plain-serializer';
import { Editor } from 'slate-react';

import { DataLinkBuiltInVars, GrafanaTheme2, VariableOrigin, VariableSuggestion } from '@grafana/data';

import { makeValue } from '../../index';
import { SlatePrism } from '../../slate-plugins';
import { useStyles2 } from '../../themes';
import { SCHEMA } from '../../utils/slate';
import CustomScrollbar from '../CustomScrollbar/CustomScrollbar';
import { getInputStyles } from '../Input/Input';
import { Portal } from '../index';

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
      onlyIn: (node: any) => node.type === 'code_block',
      getSyntax: () => 'links',
    },
    { ...(Prism.languages as LanguageMap), links: datalinksSyntax }
  ),
];

const getStyles = (theme: GrafanaTheme2) => ({
  input: getInputStyles({ theme, invalid: false }).input,
  editor: css`
    .token.builtInVariable {
      color: ${theme.colors.success.text};
    }
    .token.variable {
      color: ${theme.colors.primary.text};
    }
  `,
  suggestionsWrapper: css`
    box-shadow: ${theme.shadows.z2};
  `,
  // Wrapper with child selector needed.
  // When classnames are applied to the same element as the wrapper, it causes the suggestions to stop working
  wrapperOverrides: css`
    width: 100%;
    > .slate-query-field__wrapper {
      padding: 0;
      background-color: transparent;
      border: none;
    }
  `,
});

// This memoised also because rerendering the slate editor grabs focus which created problem in some cases this
// was used and changes to different state were propagated here.
export const DataLinkInput: React.FC<DataLinkInputProps> = memo(
  ({ value, onChange, suggestions, placeholder = 'http://your-grafana.com/d/000000010/annotations' }) => {
    const editorRef = useRef<Editor>(null);
    const styles = useStyles2(getStyles);
    const [showingSuggestions, setShowingSuggestions] = useState(false);
    const [suggestionsIndex, setSuggestionsIndex] = useState(0);
    const [linkUrl, setLinkUrl] = useState<Value>(makeValue(value));
    const prevLinkUrl = usePrevious<Value>(linkUrl);
    const [scrollTop, setScrollTop] = useState(0);

    // Workaround for https://github.com/ianstormtaylor/slate/issues/2927
    const stateRef = useRef({ showingSuggestions, suggestions, suggestionsIndex, linkUrl, onChange });
    stateRef.current = { showingSuggestions, suggestions, suggestionsIndex, linkUrl, onChange };

    // Used to get the height of the suggestion elements in order to scroll to them.
    const activeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      setScrollTop(getElementPosition(activeRef.current, suggestionsIndex));
    }, [suggestionsIndex]);

    // SelectionReference is used to position the variables suggestion relatively to current DOM selection
    const selectionRef = useMemo(() => new SelectionReference(), []);

    const onKeyDown = React.useCallback((event: React.KeyboardEvent, next: () => any) => {
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
      const includeDollarSign = Plain.serialize(editor.value).slice(-1) !== '$';
      if (item.origin !== VariableOrigin.Template || item.value === DataLinkBuiltInVars.includeVars) {
        editor.insertText(`${includeDollarSign ? '$' : ''}\{${item.value}}`);
      } else {
        editor.insertText(`\${${item.value}:queryparam}`);
      }

      setLinkUrl(editor.value);
      setShowingSuggestions(false);

      setSuggestionsIndex(0);
      stateRef.current.onChange(Plain.serialize(editor.value));
    };

    return (
      <div className={styles.wrapperOverrides}>
        <div className="slate-query-field__wrapper">
          <div className="slate-query-field">
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
              value={stateRef.current.linkUrl}
              onChange={onUrlChange}
              onKeyDown={(event, _editor, next) => onKeyDown(event, next)}
              plugins={plugins}
              className={cx(
                styles.editor,
                styles.input,
                css`
                  padding: 3px 8px;
                `
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
