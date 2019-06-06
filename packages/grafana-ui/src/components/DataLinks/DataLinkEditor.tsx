// @ts-ignore
import PluginPrism from 'slate-prism';

import React, { useState, ChangeEvent, useMemo, useContext, useCallback } from 'react';
import { DrillDownLink } from '../../index';
import { FormField, Switch, Portal } from '../index';
// @ts-ignore
import { Editor } from 'slate-react';
// @ts-ignore
import { Value, Change, Document } from 'slate';
// @ts-ignore
import Plain from 'slate-plain-serializer';

import useDebounce from 'react-use/lib/useDebounce';
import { Popper as ReactPopper } from 'react-popper';
import { DataLinkSuggestions, VariableSuggestion, VariableOrigin } from './DataLinkSuggestions';
import { SelectionReference } from './SelectionReference';
import { css } from 'emotion';
import { ThemeContext } from '../../themes/index';

import { makeValue } from '../../utils/slate';

interface DataLinkEditorProps {
  index: number;
  value: DrillDownLink;
  suggestions: VariableSuggestion[];
  onChange: (index: number, link: DrillDownLink) => void;
  onRemove: (link: DrillDownLink) => void;
}

const plugins = [
  PluginPrism({
    onlyIn: (node: any) => node.type === 'code_block',
    getSyntax: () => 'links',
  }),
];

export const DataLinkEditor: React.FC<DataLinkEditorProps> = React.memo(
  ({ index, value, onChange, onRemove, suggestions }) => {
    const theme = useContext(ThemeContext);

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

    const [title, setTitle] = useState(value.title);
    const [showingSuggestions, setShowingSuggestions] = useState(false);
    const [suggestionsIndex, setSuggestionsIndex] = useState(0);
    const [usedSuggestions, setUsedSuggestions] = useState(
      suggestions.filter(suggestion => {
        return value.url.indexOf(suggestion.value) > -1;
      })
    );
    const [linkUrl, setLinkUrl] = useState(makeValue(value.url));
    const currentSuggestions = useMemo(
      () =>
        suggestions.filter(suggestion => {
          return usedSuggestions.map(s => s.value).indexOf(suggestion.value) === -1;
        }),
      [usedSuggestions, suggestions]
    );

    // SelectionReference is used to position the variables suggestion relatively to current DOM selection
    const selectionRef = new SelectionReference();

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
      onChange(index, { ...value, url: Plain.serialize(linkUrl) });
    };

    const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
      setTitle(event.target.value);
    };

    const onTitleBlur = () => {
      onChange(index, { ...value, title: title });
    };

    const onRemoveClick = () => {
      onRemove(value);
    };

    const onOpenInNewTabChanged = () => {
      onChange(index, { ...value, targetBlank: !value.targetBlank });
    };

    const onVariableSelect = (item: VariableSuggestion) => {
      const includeDollarSign = Plain.serialize(linkUrl).slice(-1) !== '$';
      const change = linkUrl.change();

      if (item.origin === VariableOrigin.BuiltIn) {
        change.insertText(`${includeDollarSign ? '$' : ''}\{${item.value}}`);
      } else {
        change.insertText(`var-${item.value}=$${item.value}`);
      }

      setLinkUrl(change.value);
      setShowingSuggestions(false);
      setUsedSuggestions((previous: VariableSuggestion[]) => {
        return [...previous, item];
      });
      setSuggestionsIndex(0);
    };

    return (
      <div className="gf-form-inline">
        <FormField
          label="Title"
          value={title}
          onChange={onTitleChange}
          onBlur={onTitleBlur}
          inputWidth={15}
          labelWidth={6}
        />
        <div className="gf-form">
          <label className="gf-form-label">URL</label>
        </div>
        <div className="gf-form gf-form--grow">
          <div className="slate-query-field__wrapper">
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
        </div>
        <Switch label="Open in new tab" checked={value.targetBlank || false} onChange={onOpenInNewTabChanged} />
        <div className="gf-form">
          <button className="gf-form-label gf-form-label--btn" onClick={onRemoveClick}>
            <i className="fa fa-times" />
          </button>
        </div>
      </div>
    );
  }
);
