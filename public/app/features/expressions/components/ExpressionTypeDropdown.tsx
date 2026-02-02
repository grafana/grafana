import { css } from '@emotion/css';
import { memo, ReactElement, useCallback, useMemo } from 'react';

import { FeatureState, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Dropdown, FeatureBadge, Icon, Menu, Tooltip, useStyles2 } from '@grafana/ui';
import { ExpressionQueryType, expressionTypes } from 'app/features/expressions/types';

const EXPRESSION_ICON_MAP = {
  [ExpressionQueryType.math]: 'calculator-alt',
  [ExpressionQueryType.reduce]: 'compress-arrows',
  [ExpressionQueryType.resample]: 'sync',
  [ExpressionQueryType.classic]: 'cog',
  [ExpressionQueryType.threshold]: 'sliders-v-alt',
  [ExpressionQueryType.sql]: 'database',
} as const satisfies Record<ExpressionQueryType, string>;

interface ExpressionTypeDropdownProps {
  children: ReactElement<Record<string, unknown>>;
  handleOnSelect: (value: ExpressionQueryType) => void;
  disableSqlExpression?: boolean;
}

interface ExpressionMenuItemProps {
  item: SelectableValue<ExpressionQueryType>;
  onSelect: (value: ExpressionQueryType) => void;
  disabled?: boolean;
  disabledReason?: string;
}

const ExpressionMenuItem = memo<ExpressionMenuItemProps>(({ item, onSelect, disabled, disabledReason }) => {
  const { value, label, description } = item;
  const styles = useStyles2(getStyles);

  const handleClick = useCallback(() => {
    if (!disabled) {
      onSelect(value!);
    }
  }, [value, onSelect, disabled]);

  const tooltipContent = disabled ? disabledReason : description;

  return (
    <Menu.Item
      component={() => (
        <div className={styles.expressionTypeItem} role="menuitem" aria-disabled={disabled}>
          <div
            className={styles.expressionTypeItemContent}
            data-testid={`expression-type-${value}`}
            style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            <Icon className={styles.icon} name={EXPRESSION_ICON_MAP[value!]} aria-hidden="true" />
            {label}
            {value === ExpressionQueryType.sql && <FeatureBadge featureState={FeatureState.preview} />}
          </div>
          <Tooltip placement="right" content={tooltipContent || ''}>
            <Icon className={styles.infoIcon} name="info-circle" />
          </Tooltip>
        </div>
      )}
      key={value}
      label=""
      onClick={handleClick}
      disabled={disabled}
    />
  );
});

ExpressionMenuItem.displayName = 'ExpressionMenuItem';

export const ExpressionTypeDropdown = memo<ExpressionTypeDropdownProps>(
  ({ handleOnSelect, children, disableSqlExpression = false }) => {
    const menuItems = useMemo(
      () =>
        expressionTypes.map((item) => {
          const isDisabled = item.value === ExpressionQueryType.sql && disableSqlExpression;
          const disabledReason = isDisabled
            ? 'SQL expressions require a backend datasource. The current datasource only supports frontend queries.'
            : undefined;

          return (
            <ExpressionMenuItem
              key={item.value}
              item={item}
              onSelect={handleOnSelect}
              disabled={isDisabled}
              disabledReason={disabledReason}
            />
          );
        }),
      [handleOnSelect, disableSqlExpression]
    );

    const menuOverlay = useMemo(() => <Menu role="menu">{menuItems}</Menu>, [menuItems]);

    return (
      <Dropdown placement="bottom-start" overlay={menuOverlay}>
        {children}
      </Dropdown>
    );
  }
);

ExpressionTypeDropdown.displayName = 'ExpressionTypeDropdown';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    expressionTypeItem: css({
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),

    expressionTypeItemContent: css({
      flexGrow: 1,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),

    icon: css({
      color: theme.colors.text.secondary,
      flexShrink: 0,
    }),

    infoIcon: css({
      opacity: 0.7,
      color: theme.colors.text.secondary,
      flexShrink: 0,
    }),
  };
};
