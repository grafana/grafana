import React, { useState, useMemo, useCallback, useContext, useRef, RefObject } from 'react';
import { VariableSuggestion, VariableOrigin, DataLinkSuggestions } from './DataLinkSuggestions';
import { ThemeContext, DataLinkBuiltInVars, makeValue } from '../../index';
import { SelectionReference } from './SelectionReference';
import { Portal } from '../index';

import { Editor } from '@grafana/slate-react';
import { Value, Editor as CoreEditor } from 'slate';
import Plain from 'slate-plain-serializer';
import { Popper as ReactPopper } from 'react-popper';
import useDebounce from 'react-use/lib/useDebounce';
import { css, cx } from 'emotion';

import { SlatePrism } from '../../slate-plugins';
import { SCHEMA } from '../../utils/slate';

const modulo = (a: number, n: number) => a - n * Math.floor(a / n);

interface DataLinkInputProps {
  value: string;
  onChange: (url: string, callback?: () => void) => void;
  suggestions: VariableSuggestion[];
}

const plugins = [
  SlatePrism({
    onlyIn: (node: any) => node.type === 'code_block',
    getSyntax: () => 'links',
  }),
];

export const DataLinkInput: React.FC<DataLinkInputProps> = ({ value, onChange, suggestions }) => {
  const editorRef = useRef<Editor>() as RefObject<Editor>;
  const theme = useContext(ThemeContext);
  const [showingSuggestions, setShowingSuggestions] = useState(false);

  const [suggestionsIndex, setSuggestionsIndex] = useState(0);
  const [usedSuggestions, setUsedSuggestions] = useState(
    suggestions.filter(suggestion => value.includes(suggestion.value))
  );

  const [linkUrl, setLinkUrl] = useState<Value>(makeValue(value));

  const getStyles = useCallback(() => {
    return {
      editor: css`
        .token.builtInVariable {
          color: ${theme.colors.queryGreen};
        }
        .token.variable {
          color: ${theme.colors.queryKeyword};
        }
      `,
    };
  }, [theme]);

  const currentSuggestions = useMemo(
    () => suggestions.filter(suggestion => !usedSuggestions.map(s => s.value).includes(suggestion.value)),
    [usedSuggestions, suggestions]
  );

  // Workaround for https://github.com/ianstormtaylor/slate/issues/2927
  const stateRef = useRef({ showingSuggestions, currentSuggestions, suggestionsIndex, linkUrl, onChange });
  stateRef.current = { showingSuggestions, currentSuggestions, suggestionsIndex, linkUrl, onChange };

  // SelectionReference is used to position the variables suggestion relatively to current DOM selection
  const selectionRef = useMemo(() => new SelectionReference(), [setShowingSuggestions, linkUrl]);

  // Keep track of variables that has been used already
  const updateUsedSuggestions = () => {
    const currentLink = Plain.serialize(linkUrl);
    const next = usedSuggestions.filter(suggestion => currentLink.includes(suggestion.value));
    if (next.length !== usedSuggestions.length) {
      setUsedSuggestions(next);
    }
  };

  useDebounce(updateUsedSuggestions, 250, [linkUrl]);

  const onKeyDown = React.useCallback((event: KeyboardEvent, next: () => any) => {
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
        return onVariableSelect(stateRef.current.currentSuggestions[stateRef.current.suggestionsIndex]);

      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        return setSuggestionsIndex(index => modulo(index + direction, stateRef.current.currentSuggestions.length));
      default:
        return next();
    }
  }, []);

  const onUrlChange = React.useCallback(({ value }: { value: Value }) => {
    setLinkUrl(value);
  }, []);

  const onUrlBlur = React.useCallback((event: Event, editor: CoreEditor, next: () => any) => {
    // Callback needed for blur to work correctly
    stateRef.current.onChange(Plain.serialize(stateRef.current.linkUrl), () => {
      editorRef.current!.blur();
    });
  }, []);

  const onVariableSelect = (item: VariableSuggestion, editor = editorRef.current!) => {
    const includeDollarSign = Plain.serialize(editor.value).slice(-1) !== '$';
    if (item.origin !== VariableOrigin.Template || item.value === DataLinkBuiltInVars.includeVars) {
      editor.insertText(`${includeDollarSign ? '$' : ''}\{${item.value}}`);
    } else {
      editor.insertText(`var-${item.value}=$\{${item.value}}`);
    }

    setLinkUrl(editor.value);
    setShowingSuggestions(false);
    setUsedSuggestions((previous: VariableSuggestion[]) => {
      return [...previous, item];
    });
    setSuggestionsIndex(0);
    onChange(Plain.serialize(editor.value));
  };

  return (
    <div
      className={cx(
        'gf-form-input',
        css`
          position: relative;
          height: auto;
        `
      )}
    >
      <div className="slate-query-field">
        {showingSuggestions && (
          <Portal>
            <ReactPopper
              referenceElement={selectionRef}
              placement="top-end"
              modifiers={{
                preventOverflow: { enabled: true, boundariesElement: 'window' },
                arrow: { enabled: false },
                offset: { offset: 250 }, // width of the suggestions menu
              }}
            >
              {({ ref, style, placement }) => {
                return (
                  <div ref={ref} style={style} data-placement={placement}>
                    <DataLinkSuggestions
                      suggestions={currentSuggestions}
                      onSuggestionSelect={onVariableSelect}
                      onClose={() => setShowingSuggestions(false)}
                      activeIndex={suggestionsIndex}
                    />
                  </div>
                );
              }}
            </ReactPopper>
          </Portal>
        )}
        <Editor
          schema={SCHEMA}
          ref={editorRef}
          placeholder="http://your-grafana.com/d/000000010/annotations"
          value={stateRef.current.linkUrl}
          onChange={onUrlChange}
          onBlur={onUrlBlur}
          onKeyDown={(event, _editor, next) => onKeyDown(event as KeyboardEvent, next)}
          plugins={plugins}
          className={getStyles().editor}
        />
      </div>
    </div>
  );
};

DataLinkInput.displayName = 'DataLinkInput';
