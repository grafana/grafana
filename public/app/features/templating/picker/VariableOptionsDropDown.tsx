import React, { MouseEvent, PureComponent } from 'react';
import { ClickOutsideWrapper, getTagColorsFromName } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

import { QueryVariableModel, VariableOption, VariableTag } from '../variable';
import { dispatch } from '../../../store/store';
import { toVariablePayload } from '../state/actions';
import { QueryVariablePickerState } from '../state/queryVariableReducer';
import { variableAdapters } from '../adapters';
import {
  changeQueryVariableHighlightIndex,
  hideQueryVariableDropDown,
  selectVariableOption,
  selectVariableOptionByHighlightIndex,
  toggleAllVariableOptions,
  toggleTag,
} from '../state/queryVariableActions';
import { VariablePickerProps } from '../state/types';

export interface Props extends VariablePickerProps<QueryVariableModel, QueryVariablePickerState> {}

enum NavigationKeys {
  moveUp = 38,
  moveDown = 40,
  select = 32,
  cancel = 27,
  selectAndClose = 13,
}

export class VariableOptionsDropDown extends PureComponent<Props> {
  selectAll = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    dispatch(toggleAllVariableOptions(toVariablePayload(this.props.variable)));
  };

  toggleTag = (tag: VariableTag) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const { uuid } = this.props.variable;
    dispatch(toggleTag(uuid!, tag));
  };

  onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.keyCode === NavigationKeys.cancel) {
      return this.commitChanges();
    }

    if (event.keyCode === NavigationKeys.moveDown) {
      const payload = toVariablePayload(this.props.variable, 1);
      return dispatch(changeQueryVariableHighlightIndex(payload));
    }

    if (event.keyCode === NavigationKeys.moveUp) {
      const payload = toVariablePayload(this.props.variable, -1);
      return dispatch(changeQueryVariableHighlightIndex(payload));
    }

    const { uuid } = this.props.variable;
    const { highlightIndex } = this.props.picker;

    if (event.keyCode === NavigationKeys.select) {
      return dispatch(selectVariableOptionByHighlightIndex(uuid!, highlightIndex));
    }

    if (event.keyCode === NavigationKeys.selectAndClose) {
      dispatch(selectVariableOptionByHighlightIndex(uuid!, highlightIndex));
      return this.commitChanges();
    }
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

  onCloseDropDown = () => {
    this.commitChanges();
  };

  render() {
    const { selectedValues, highlightIndex, options, tags } = this.props.picker;

    if (!this.props.variable) {
      return <div>Couldn't load variable</div>;
    }

    const { multi } = this.props.variable;
    return (
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
                  onClick={this.selectAll}
                  // bs-tooltip="'Clear selections'"
                  data-placement="top"
                  // ng-click="vm.clearSelections()"
                >
                  <span className="variable-option-icon"></span>
                  Selected ({selectedValues.length})
                </a>
              )}
              {options.map((option, index) => {
                const selectClass = option.selected ? 'variable-option pointer selected' : 'variable-option pointer';
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
                      onClick={this.toggleTag(tag)}
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
    );
  }
}
