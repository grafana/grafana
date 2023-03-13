import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Tooltip, Themeable2, withTheme2, clearButtonStyles, stylesFactory } from '@grafana/ui';
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
    const { multi, values, highlightIndex, selectedValues, onToggle, onToggleAll, theme, ...restProps } = this.props;
    const styles = getStyles(theme);

    return (
      <div className={styles.variableValueDropdown}>
        <div className={styles.variableOptionsWrapper}>
          <ul
            className={styles.variableOptionsColumn}
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
    const { highlightIndex, multi, theme } = this.props;
    const styles = getStyles(theme);

    const isAllOption = option.value === ALL_VARIABLE_VALUE;

    return (
      <li key={`${option.value}`}>
        <button
          data-testid={selectors.components.Variables.variableOption}
          role="checkbox"
          type="button"
          aria-checked={option.selected}
          className={cx(
            clearButtonStyles(theme),
            styles.variableOption,
            {
              [styles.highlighted]: index === highlightIndex,
            },
            styles.noStyledButton
          )}
          onClick={this.onToggle(option)}
        >
          <span
            className={cx(styles.variableOptionIcon, {
              [styles.variableOptionIconSelected]: option.selected,
              [styles.hideVariableOptionIcon]: !multi,
            })}
          ></span>
          <span data-testid={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(`${option.text}`)}>
            {isAllOption ? t('variable.picker.option-all', 'All') : option.text}
          </span>
        </button>
      </li>
    );
  }

  renderMultiToggle() {
    const { multi, selectedValues, theme } = this.props;
    const styles = getStyles(theme);

    if (!multi) {
      return null;
    }

    const tooltipContent = () => <Trans i18nKey="variable.picker.option-tooltip">Clear selections</Trans>;

    return (
      <Tooltip content={tooltipContent} placement={'top'}>
        <button
          className={cx(
            clearButtonStyles(theme),
            styles.variableOption,
            styles.variableOptionColumnHeader,
            styles.noStyledButton
          )}
          role="checkbox"
          aria-checked={selectedValues.length > 1 ? 'mixed' : 'false'}
          onClick={this.onToggleAll}
          aria-label="Toggle all values"
          data-placement="top"
        >
          <span
            className={cx(styles.variableOptionIcon, {
              [styles.variableOptionIconManySelected]: selectedValues.length > 1,
            })}
          ></span>
          <Trans i18nKey="variable.picker.option-selected-values">Selected</Trans> ({selectedValues.length})
        </button>
      </Tooltip>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  const checkboxImageUrl = theme.isDark ? 'public/img/checkbox.png' : 'public/img/checkbox_white.png';

  return {
    hideVariableOptionIcon: css({
      display: 'none',
    }),
    highlighted: css({
      backgroundColor: theme.colors.action.hover,
    }),
    noStyledButton: css({
      width: '100%',
      textAlign: 'left',
    }),
    variableOption: css({
      display: 'block',
      padding: '2px 27px 0 8px',
      position: 'relative',
      whiteSpace: 'nowrap',
      minWidth: '115px',
      ['&:hover']: {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    variableOptionColumnHeader: css({
      paddingTop: '5px',
      paddingBottom: '5px',
      marginBottom: '5px',
    }),
    variableOptionIcon: css({
      display: 'inline-block',
      width: '24px',
      height: '18px',
      position: 'relative',
      top: '4px',
      background: `url(${checkboxImageUrl}) left top no-repeat`,
    }),
    variableOptionIconManySelected: css({
      background: `url(${checkboxImageUrl}) 0px -36px no-repeat`,
    }),
    variableOptionIconSelected: css({
      background: `url(${checkboxImageUrl}) 0px -18px no-repeat`,
    }),
    variableValueDropdown: css({
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.borderRadius(2),
      boxShadow: theme.shadows.z2,
      position: 'absolute',
      top: theme.spacing(theme.components.height.md),
      maxHeight: '400px',
      minHeight: '150px',
      minWidth: '150px',
      overflowY: 'auto',
      overflowX: 'hidden',
      zIndex: theme.zIndex.typeahead,
    }),
    variableOptionsColumn: css({
      maxHeight: '350px',
      display: 'table-cell',
      lineHeight: '26px',
      listStyleType: 'none',
    }),
    variableOptionsWrapper: css({
      display: 'table',
      width: '100%',
    }),
  };
});

export default withTheme2(VariableOptions);
