import { css, cx } from '@emotion/css';
import { memo, type MouseEvent, type HTMLProps } from 'react';

import { GrafanaTheme2, VariableOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Tooltip, clearButtonStyles, useStyles2, useTheme2 } from '@grafana/ui';
import checkboxPng from 'img/checkbox.png';
import checkboxWhitePng from 'img/checkbox_white.png';

import { ALL_VARIABLE_VALUE } from '../../constants';

export interface Props extends Omit<HTMLProps<HTMLUListElement>, 'onToggle'> {
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

export const VariableOptions = memo(
  ({ multi, values, highlightIndex, selectedValues, onToggle, onToggleAll, ...restProps }: Props) => {
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const buttonReset = clearButtonStyles(theme);

    const handleEvent = (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const handleToggle = (option: VariableOption) => (event: MouseEvent<HTMLButtonElement>) => {
      const clearOthers = event.shiftKey || event.ctrlKey || event.metaKey;
      handleEvent(event);
      onToggle(option, clearOthers);
    };

    const handleToggleAll = (event: MouseEvent<HTMLButtonElement>) => {
      handleEvent(event);
      onToggleAll();
    };

    const isAllOptionConfigured = values.some((option) => option.value === ALL_VARIABLE_VALUE);

    const renderMultiToggle = () => {
      if (!multi) {
        return null;
      }

      const tooltipContent = () => <Trans i18nKey="variable.picker.option-tooltip">Clear selections</Trans>;
      return (
        <Tooltip content={tooltipContent} placement={'top'}>
          <button
            className={cx(
              buttonReset,
              styles.variableOption,
              styles.variableOptionColumnHeader,
              styles.noStyledButton,
              { [styles.noPaddingBotton]: isAllOptionConfigured }
            )}
            role="checkbox"
            aria-checked={selectedValues.length > 1 ? 'mixed' : 'false'}
            onClick={handleToggleAll}
            aria-label={t('variables.variable-options.aria-label-toggle-all-values', 'Toggle all values')}
            data-placement="top"
          >
            <span
              className={cx(styles.variableOptionIcon, {
                [styles.variableOptionIconManySelected]: selectedValues.length > 1,
              })}
            ></span>
            <Trans i18nKey="variable.picker.option-selected-values" values={{ numSelected: selectedValues.length }}>
              Selected ({'{{numSelected}}'})
            </Trans>
          </button>
        </Tooltip>
      );
    };

    return (
      <div className={styles.variableValueDropdown}>
        <div className={styles.variableOptionsWrapper}>
          <ul
            className={styles.variableOptionsColumn}
            aria-label={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown}
            {...restProps}
          >
            {renderMultiToggle()}
            {values.map((option, index) => {
              const isAllOption = option.value === ALL_VARIABLE_VALUE;

              return (
                <li key={`${option.value}`}>
                  <button
                    data-testid={selectors.components.Variables.variableOption}
                    role="checkbox"
                    type="button"
                    aria-checked={option.selected}
                    className={cx(
                      buttonReset,
                      styles.variableOption,
                      {
                        [styles.highlighted]: index === highlightIndex,
                        [styles.variableAllOption]: isAllOption,
                      },
                      styles.noStyledButton
                    )}
                    onClick={handleToggle(option)}
                  >
                    <span
                      className={cx(styles.variableOptionIcon, {
                        [styles.variableOptionIconSelected]: option.selected,
                        [styles.hideVariableOptionIcon]: !multi,
                      })}
                    ></span>
                    <span
                      data-testid={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(
                        `${option.text}`
                      )}
                    >
                      {isAllOption ? t('variable.picker.option-all', 'All') : option.text}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
);
VariableOptions.displayName = 'VariableOptions';

const getStyles = (theme: GrafanaTheme2) => {
  const checkboxImageUrl = theme.isDark ? checkboxPng : checkboxWhitePng;

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
    variableAllOption: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      paddingBottom: theme.spacing(1),
    }),

    noPaddingBotton: css({
      paddingBottom: 0,
    }),
  };
};
