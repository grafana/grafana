// @ts-ignore
import PluginPrism from 'slate-prism';
// @ts-ignore
import Prism from 'prismjs';
import React, { useState, ChangeEvent, useMemo } from 'react';
import { DrillDownLink } from '../../index';
import { FormField, Switch, Portal } from '../index';
// @ts-ignore
import { Editor } from 'slate-react';
// @ts-ignore
import { Value, Change } from 'slate';
// @ts-ignore
import Plain from 'slate-plain-serializer';

import useDebounce from 'react-use/lib/useDebounce';
import { Popper as ReactPopper } from 'react-popper';
import { DrilldownSuggestions, VariableSuggestion } from './LinksSuggestions';

interface DrilldownLinkEditorProps {
  index: number;
  value: DrillDownLink;
  suggestions: VariableSuggestion[];
  onChange: (index: number, link: DrillDownLink) => void;
  onRemove: (link: DrillDownLink) => void;
}
const plugins = [
  PluginPrism({
    onlyIn: (node: any) => node.type === 'code_block',
  }),
];

class SelectionReference {
  getBoundingClientRect() {
    const selection = window.getSelection();
    const node = selection && selection.anchorNode;

    if (node && node.parentElement) {
      const rect = node.parentElement.getBoundingClientRect();
      return rect;
    }

    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
    };
  }

  get clientWidth() {
    return this.getBoundingClientRect().width;
  }

  get clientHeight() {
    return this.getBoundingClientRect().height;
  }
}

export const DrilldownLinkEditor: React.FC<DrilldownLinkEditorProps> = React.memo(
  ({ index, value, onChange, onRemove, suggestions }) => {
    const [showingSuggestions, setShowingSuggestions] = useState(false);
    const [suggestionsIndex, setSuggestionsIndex] = useState(0);
    const [usedSuggestions, setUsedSuggestions] = useState<VariableSuggestion[]>([]);

    const [title, setTitle] = useState(value.title);
    const [linkUrl, setLinkUrl] = useState(
      Value.fromJSON({
        document: {
          nodes: [
            {
              object: 'block',
              type: 'code_block',
              nodes: [
                {
                  object: 'text',
                  leaves: [
                    {
                      text: value.url,
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
    );

    const getCurrentSuggestions = useMemo(
      () =>
        suggestions.filter(suggestion => {
          return usedSuggestions.map(s => s.value).indexOf(suggestion.value) === -1;
        }),
      [usedSuggestions]
    );

    const selectionRef = new SelectionReference();

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
          onVariableSelect(getCurrentSuggestions[suggestionsIndex]);
        }
      }

      if (showingSuggestions) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSuggestionsIndex(index => {
            return (index + 1) % suggestions.length;
          });
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSuggestionsIndex(index => {
            const nextIndex = index - 1 < 0 ? suggestions.length - 1 : (index - 1) % suggestions.length;
            return nextIndex;
          });
        }
      }

      if (event.key === '?' || event.key === '&' || (event.keyCode === 32 && event.ctrlKey)) {
        setShowingSuggestions(true);
      }
      return true;
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
      const change = linkUrl.change();
      change.insertText(item.value);
      setLinkUrl(change.value);
      setShowingSuggestions(false);
      setUsedSuggestions(previous => {
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
                          <DrilldownSuggestions
                            suggestions={getCurrentSuggestions}
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
