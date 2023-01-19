import { css, cx } from '@emotion/css';
import classNames from 'classnames';
import React, { PureComponent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Tooltip, Themeable2, withTheme2, clearButtonStyles } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { ALL_VARIABLE_VALUE } from '../../constants';
import { VariableOption } from '../../types';

export interface Props extends React.HTMLProps<HTMLUListElement>, Themeable2 {
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

class VariableOptions extends PureComponent<Props> {
  onToggle = (option: VariableOption) => (event: React.MouseEvent<HTMLButtonElement>) => {
    const clearOthers = event.shiftKey || event.ctrlKey || event.metaKey;
    this.handleEvent(event);
    this.props.onToggle(option, clearOthers);
  };

  onToggleAll = (event: React.MouseEvent<HTMLButtonElement>) => {
    this.handleEvent(event);
    this.props.onToggleAll();
  };

  handleEvent(event: React.MouseEvent<HTMLButtonElement>) {
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
    const { highlightIndex, theme } = this.props;
    const selectClass = option.selected ? 'variable-option pointer selected' : 'variable-option pointer';
    const highlightClass = index === highlightIndex ? `${selectClass} highlighted` : selectClass;

    const isAllOption = option.value === ALL_VARIABLE_VALUE;

    return (
      <li key={`${option.value}`}>
        <button
          role="checkbox"
          type="button"
          aria-checked={option.selected}
          className={classNames(highlightClass, clearButtonStyles(theme), noStyledButton)}
          onClick={this.onToggle(option)}
        >
          <span className="variable-option-icon"></span>
          <span data-testid={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(`${option.text}`)}>
            {isAllOption ? t('variable.picker.option-all', 'All') : option.text}
          </span>
        </button>
      </li>
    );
  }

  renderMultiToggle() {
    const { multi, selectedValues, theme } = this.props;

    if (!multi) {
      return null;
    }

    const tooltipContent = () => <Trans i18nKey="variable.picker.option-tooltip">Clear selections</Trans>;

    return (
      <Tooltip content={tooltipContent} placement={'top'}>
        <button
          className={`${
            selectedValues.length > 1
              ? 'variable-options-column-header many-selected'
              : 'variable-options-column-header'
          } ${noStyledButton} ${clearButtonStyles(theme)}`}
          role="checkbox"
          aria-checked={selectedValues.length > 1 ? 'mixed' : 'false'}
          onClick={this.onToggleAll}
          aria-label="Toggle all values"
          data-placement="top"
        >
          <span className="variable-option-icon"></span>
          <Trans i18nKey="variable.picker.option-selected-values">Selected</Trans> ({selectedValues.length})
        </button>
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

const noStyledButton = css`
  width: 100%;
  text-align: left;
`;

export default withTheme2(VariableOptions);
