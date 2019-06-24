import React, { useState, useMemo, useCallback, useContext } from 'react';
import { VariableSuggestion, VariableOrigin, DataLinkSuggestions } from './DataLinkSuggestions';
import { makeValue, ThemeContext } from '../../index';
import { SelectionReference } from './SelectionReference';
import { Portal } from '../index';
// @ts-ignore
import { Editor } from 'slate-react';
// @ts-ignore
import { Value, Change, Document } from 'slate';
// @ts-ignore
import Plain from 'slate-plain-serializer';
import { Popper as ReactPopper } from 'react-popper';
import useDebounce from 'react-use/lib/useDebounce';
import { css, cx } from 'emotion';
// @ts-ignore
import PluginPrism from 'slate-prism';

interface DataLinkInputProps {
  value: string;
  onChange: (url: string) => void;
  suggestions: VariableSuggestion[];
}

const plugins = [
  PluginPrism({
    onlyIn: (node: any) => node.type === 'code_block',
    getSyntax: () => 'links',
  }),
];

export const DataLinkInput: React.FC<DataLinkInputProps> = ({ value, onChange, suggestions }) => {
  const theme = useContext(ThemeContext);
  const [showingSuggestions, setShowingSuggestions] = useState(false);
  const [suggestionsIndex, setSuggestionsIndex] = useState(0);
  const [usedSuggestions, setUsedSuggestions] = useState(
    suggestions.filter(suggestion => {
      return value.indexOf(suggestion.value) > -1;
    })
  );
  // Using any here as TS has problem pickung up `change` method existance on Value
  // According to code and documentation `change` is an instance method on Value in slate 0.33.8 that we use
  // https://github.com/ianstormtaylor/slate/blob/slate%400.33.8/docs/reference/slate/value.md#change
  const [linkUrl, setLinkUrl] = useState<any>(makeValue(value));

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
    () =>
      suggestions.filter(suggestion => {
        return usedSuggestions.map(s => s.value).indexOf(suggestion.value) === -1;
      }),
    [usedSuggestions, suggestions]
  );

  // SelectionReference is used to position the variables suggestion relatively to current DOM selection
  const selectionRef = useMemo(() => new SelectionReference(), [setShowingSuggestions]);

  // Keep track of variables that has been used already
  const updateUsedSuggestions = () => {
    const currentLink = Plain.serialize(linkUrl);
    const next = usedSuggestions.filter(suggestion => {
      return currentLink.indexOf(suggestion.value) > -1;
    });
    if (next.length !== usedSuggestions.length) {
      setUsedSuggestions(next);
    }
  };

  useDebounce(updateUsedSuggestions, 500, [linkUrl]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Backspace') {
      setShowingSuggestions(false);
      setSuggestionsIndex(0);
    }

    if (event.key === 'Enter') {
      if (showingSuggestions) {
        onVariableSelect(currentSuggestions[suggestionsIndex]);
      }
    }

    if (showingSuggestions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSuggestionsIndex(index => {
          return (index + 1) % currentSuggestions.length;
        });
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSuggestionsIndex(index => {
          const nextIndex = index - 1 < 0 ? currentSuggestions.length - 1 : (index - 1) % currentSuggestions.length;
          return nextIndex;
        });
      }
    }

    if (event.key === '?' || event.key === '&' || event.key === '$' || (event.keyCode === 32 && event.ctrlKey)) {
      setShowingSuggestions(true);
    }

    if (event.key === 'Backspace') {
      // @ts-ignore
      return;
    } else {
      return true;
    }
  };

  const onUrlChange = ({ value }: Change) => {
    setLinkUrl(value);
  };

  const onUrlBlur = () => {
    onChange(Plain.serialize(linkUrl));
  };

  const onVariableSelect = (item: VariableSuggestion) => {
    const includeDollarSign = Plain.serialize(linkUrl).slice(-1) !== '$';

    const change = linkUrl.change();

    if (item.origin === VariableOrigin.BuiltIn) {
      change.insertText(`${includeDollarSign ? '$' : ''}\{${item.value}}`);
    } else {
      change.insertText(`var-${item.value}=$\{${item.value}}`);
    }

    setLinkUrl(change.value);
    setShowingSuggestions(false);
    setUsedSuggestions((previous: VariableSuggestion[]) => {
      return [...previous, item];
    });
    setSuggestionsIndex(0);
    onChange(Plain.serialize(change.value));
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
              placement="auto-end"
              modifiers={{
                preventOverflow: { enabled: true, boundariesElement: 'window' },
                arrow: { enabled: false },
                offset: { offset: 200 }, // width of the suggestions menu
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
          placeholder="http://your-grafana.com/d/000000010/annotations"
          value={linkUrl}
          onChange={onUrlChange}
          onBlur={onUrlBlur}
          onKeyDown={onKeyDown}
          plugins={plugins}
          className={getStyles().editor}
        />
      </div>
    </div>
  );
};

DataLinkInput.displayName = 'DataLinkInput';
