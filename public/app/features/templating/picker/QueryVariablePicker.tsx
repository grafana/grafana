import React, { MouseEvent, PureComponent } from 'react';
import debounce from 'lodash/debounce';
import { ClickOutsideWrapper, getTagColorsFromName } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

import { QueryVariableModel, VariableOption, VariableTag } from '../variable';
import { dispatch } from '../../../store/store';
import { toVariablePayload } from '../state/actions';
import { QueryVariablePickerState } from '../state/queryVariableReducer';
import { variableAdapters } from '../adapters';
import {
  hideQueryVariableDropDown,
  selectVariableOption,
  showQueryVariableDropDown,
  selectVariableTag,
  deselectVariableTag,
} from '../state/queryVariableActions';
import { VariablePickerProps } from '../state/types';

export interface Props extends VariablePickerProps<QueryVariableModel, QueryVariablePickerState> {}

export class QueryVariablePicker extends PureComponent<Props> {
  private readonly debouncedOnQueryChanged: Function;
  constructor(props: Props) {
    super(props);
    this.debouncedOnQueryChanged = debounce((searchQuery: string) => {
      this.onQueryChanged(searchQuery);
    }, 200);
  }

  onShowDropDown = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    dispatch(showQueryVariableDropDown(toVariablePayload(this.props.variable)));
  };

  selectTag = (tag: VariableTag) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const { uuid } = this.props.variable;
    dispatch(selectVariableTag(uuid, tag));
  };

  deselectTag = (tag: VariableTag) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    dispatch(deselectVariableTag(toVariablePayload(this.props.variable, tag)));
  };

  selectValue = (option: VariableOption) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (!option) {
      return;
    }

    dispatch(selectVariableOption(toVariablePayload(this.props.variable, { option, forceSelect: false, event })));
  };

  commitChanges = () => {
    const { queryHasSearchFilter, oldVariableText } = this.props.picker;

    if (queryHasSearchFilter) {
      // this.updateLazyLoadedOptions();
    }

    if (this.props.variable.current.text !== oldVariableText) {
      variableAdapters.get(this.props.variable.type).setValue(this.props.variable, this.props.variable.current);
    }
    dispatch(hideQueryVariableDropDown(toVariablePayload(this.props.variable)));
  };

  onQueryChanged = (searchQuery: string) => {};

  onCloseDropDown = () => {
    this.commitChanges();
  };

  render() {
    const {
      linkText,
      selectedTags,
      searchQuery,
      showDropDown,
      selectedValues,
      highlightIndex,
      options,
      tags,
    } = this.props.picker;

    if (!this.props.variable) {
      return <div>Couldn't load variable</div>;
    }

    const { multi } = this.props.variable;
    return (
      <div className="variable-link-wrapper">
        {!showDropDown && (
          <a
            onClick={this.onShowDropDown}
            className="variable-value-link"
            aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItemValueDropDownValueLinkTexts(`${linkText}`)}
          >
            {linkText}
            {selectedTags.map(tag => {
              const { color, borderColor } = getTagColorsFromName(tag.text.toString());
              return (
                <span bs-tooltip="tag.valuesText" data-placement="bottom" key={`${tag.text}`}>
                  <span className="label-tag" style={{ backgroundColor: color, borderColor }} />
                  <span className="label-tag">
                    &nbsp;&nbsp;<i className="fa fa-tag"></i>&nbsp; {tag.text}
                  </span>
                </span>
              );
            })}
            <i className="fa fa-caret-down" style={{ fontSize: '12px' }}></i>
          </a>
        )}

        {showDropDown && (
          <ClickOutsideWrapper onClick={this.onCloseDropDown}>
            <input
              ref={instance => {
                if (instance) {
                  instance.focus();
                  instance.setAttribute('style', `width:${Math.max(instance.width, 80)}px`);
                }
              }}
              type="text"
              className="gf-form-input"
              value={searchQuery ?? ''}
              onChange={event => this.debouncedOnQueryChanged(event.target.value)}
              // inputEl.css('width', Math.max(linkEl.width(), 80) + 'px');
              // ng-keydown="vm.keyDown($event)"
              // ng-model="vm.search.query"
              // ng-change="vm.debouncedQueryChanged()"
            />
          </ClickOutsideWrapper>
        )}

        {showDropDown && (
          <ClickOutsideWrapper onClick={this.onCloseDropDown}>
            <div
              className={`${multi ? 'variable-value-dropdown multi' : 'variable-value-dropdown single'}`}
              aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItemValueDropDownDropDown}
            >
              <div className="variable-options-wrapper">
                <div className="variable-options-column">
                  {multi && (
                    <a
                      className={`${
                        selectedValues.length > 1
                          ? 'variable-options-column-header many-selected'
                          : 'variable-options-column-header'
                      }`}
                      // bs-tooltip="'Clear selections'"
                      data-placement="top"
                      // ng-click="vm.clearSelections()"
                    >
                      <span className="variable-option-icon"></span>
                      Selected ({selectedValues.length})
                    </a>
                  )}
                  {options.map((option, index) => {
                    const selectClass = option.selected
                      ? 'variable-option pointer selected'
                      : 'variable-option pointer';
                    const highlightClass = index === highlightIndex ? `${selectClass} highlighted` : selectClass;
                    return (
                      <a key={`${option.value}`} className={highlightClass} onClick={this.selectValue(option)}>
                        <span className="variable-option-icon"></span>
                        <span
                          aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItemValueDropDownOptionTexts(
                            `${option.text}`
                          )}
                        >
                          {option.text}
                        </span>
                      </a>
                    );
                  })}
                </div>
                {tags.length > 0 && (
                  <div className="variable-options-column">
                    <div className="variable-options-column-header text-center">Tags</div>
                    {tags.map((tag, index) => {
                      const { color, borderColor } = getTagColorsFromName(tag.text.toString());

                      return (
                        <a
                          key={`${tag.text}`}
                          className={`${
                            tag.selected ? 'variable-option-tag pointer selected' : 'variable-option-tag pointer'
                          }`}
                          onClick={tag.selected ? this.deselectTag(tag) : this.selectTag(tag)}
                        >
                          <span className="fa fa-fw variable-option-icon"></span>
                          <span className="label-tag" style={{ backgroundColor: color, borderColor }}>
                            {tag.text}&nbsp;&nbsp;<i className="fa fa-tag"></i>&nbsp;
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ClickOutsideWrapper>
        )}
      </div>
    );
  }
}
