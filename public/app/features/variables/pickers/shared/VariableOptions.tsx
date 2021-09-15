import React, { PureComponent } from 'react';
import { Tooltip } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { VariableOption } from '../../types';
import { css, cx } from '@emotion/css';

export interface Props extends React.HTMLProps<HTMLUListElement> {
  multi: boolean;
  values: VariableOption[];
  selectedValues: VariableOption[];
  highlightIndex: number;
  onToggle: (option: VariableOption, clearOthers: boolean) => void;
  onToggleAll: () => void;
  /**
   * Used for aria-controls
   */
  id: string;
}

export class VariableOptions extends PureComponent<Props> {
  onToggle = (option: VariableOption) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    const clearOthers = event.shiftKey || event.ctrlKey || event.metaKey;
    this.handleEvent(event);
    this.props.onToggle(option, clearOthers);
  };

  onToggleAll = (event: React.MouseEvent<HTMLAnchorElement>) => {
    this.handleEvent(event);
    this.props.onToggleAll();
  };

  handleEvent(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  render() {
    // Don't want to pass faulty rest props to the div
    const { multi, values, highlightIndex, selectedValues, onToggle, onToggleAll, ...restProps } = this.props;

    return (
      <div className={`${multi ? 'variable-value-dropdown multi' : 'variable-value-dropdown single'}`}>
        <div className="variable-options-wrapper">
          <ul
            className={listStyles}
            aria-label={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown}
            {...restProps}
          >
            {this.renderMultiToggle()}
            {values.map((option, index) => this.renderOption(option, index))}
          </ul>
        </div>
      </div>
    );
  }

  renderOption(option: VariableOption, index: number) {
    const { highlightIndex } = this.props;
    const selectClass = option.selected ? 'variable-option pointer selected' : 'variable-option pointer';
    const highlightClass = index === highlightIndex ? `${selectClass} highlighted` : selectClass;

    return (
      <li key={`${option.value}`}>
        <a role="checkbox" aria-checked={option.selected} className={highlightClass} onClick={this.onToggle(option)}>
          <span className="variable-option-icon"></span>
          <span data-testid={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(`${option.text}`)}>
            {option.text}
          </span>
        </a>
      </li>
    );
  }

  renderMultiToggle() {
    const { multi, selectedValues } = this.props;

    if (!multi) {
      return null;
    }

    return (
      <Tooltip content={'Clear selections'} placement={'top'}>
        <a
          className={`${
            selectedValues.length > 1
              ? 'variable-options-column-header many-selected'
              : 'variable-options-column-header'
          }`}
          role="checkbox"
          aria-checked={selectedValues.length > 1 ? 'mixed' : 'false'}
          onClick={this.onToggleAll}
          aria-label="Toggle all values"
          data-placement="top"
        >
          <span className="variable-option-icon"></span>
          Selected ({selectedValues.length})
        </a>
      </Tooltip>
    );
  }
}

const listStyles = cx(
  'variable-options-column',
  css`
    list-style-type: none;
  `
);
