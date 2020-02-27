import React, { MouseEvent, PureComponent } from 'react';
import { ClickOutsideWrapper } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

import { VariableOption, CustomVariableModel } from '../variable';
import { dispatch } from '../../../store/store';
import {
  toVariablePayload,
  hideVariableDropDown,
  toggleAllVariableOptions,
  selectVariableOption,
} from '../state/actions';
import { variableAdapters } from '../adapters';
import { VariablePickerProps } from '../state/types';
import { CustomVariablePickerState } from './reducer';

export interface Props extends VariablePickerProps<CustomVariableModel, CustomVariablePickerState> {}

export class CustomVariableOptionsDropDown extends PureComponent<Props> {
  selectAll = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    dispatch(toggleAllVariableOptions(toVariablePayload(this.props.variable)));
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
    const { oldVariableText } = this.props.picker;

    if (this.props.variable.current.text !== oldVariableText) {
      variableAdapters.get(this.props.variable.type).setValue(this.props.variable, this.props.variable.current, true);
    }
    dispatch(hideVariableDropDown(toVariablePayload(this.props.variable)));
  };

  onCloseDropDown = () => {
    this.commitChanges();
  };

  render() {
    const { selectedValues, highlightIndex, options } = this.props.picker;

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
          </div>
        </div>
      </ClickOutsideWrapper>
    );
  }
}
