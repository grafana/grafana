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
  disabledExpressions?: Partial<Record<ExpressionQueryType, string>>;
}

interface ExpressionMenuItemProps {
  item: SelectableValue<ExpressionQueryType>;
  onSelect: (value: ExpressionQueryType) => void;
  disabled?: string;
}

const ExpressionMenuItem = memo<ExpressionMenuItemProps>(({ item, onSelect, disabled }) => {
  const { value, label, description } = item;
  const styles = useStyles2(getStyles);

  const handleClick = useCallback(() => {
    if (!disabled) {
      onSelect(value!);
    }
  }, [value, onSelect, disabled]);

  const tooltipContent = disabled || description;

  return (
    <Menu.Item
      component={() => (
        <div className={styles.expressionTypeItem} role="menuitem" aria-disabled={!!disabled}>
          <div
            className={styles.expressionTypeItemContent}
            data-testid={`expression-type-${value}`}
            style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            <Icon className={styles.icon} name={EXPRESSION_ICON_MAP[value!]} aria-hidden="true" />
            {label}
            {value === ExpressionQueryType.sql && <FeatureBadge featureState={FeatureState.preview} />}
          </div>
          <Tooltip placement="right" content={tooltipContent!}>
            <Icon className={styles.infoIcon} name="info-circle" />
          </Tooltip>
        </div>
      )}
      key={value}
      label=""
      onClick={handleClick}
      disabled={!!disabled}
    />
  );
});

ExpressionMenuItem.displayName = 'ExpressionMenuItem';

export const ExpressionTypeDropdown = memo<ExpressionTypeDropdownProps>(
  ({ handleOnSelect, children, disabledExpressions = {} }) => {
    const menuItems = useMemo(
      () =>
        expressionTypes.map((item) => {
          const disabledReason = item.value ? disabledExpressions[item.value] : undefined;

          return (
            <ExpressionMenuItem key={item.value} item={item} onSelect={handleOnSelect} disabled={disabledReason} />
          );
        }),
      [handleOnSelect, disabledExpressions]
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
