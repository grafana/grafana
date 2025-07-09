import { css } from '@emotion/css';
import { ReactElement, useCallback, useMemo, memo } from 'react';

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
  children: ReactElement;
  handleOnSelect: (value: ExpressionQueryType) => void;
}

interface ExpressionMenuItemProps {
  item: SelectableValue<ExpressionQueryType>;
  onSelect: (value: ExpressionQueryType) => void;
}

const ExpressionMenuItem = memo<ExpressionMenuItemProps>(({ item, onSelect }) => {
  const { value, label, description } = item;
  const styles = useStyles2(getStyles);

  const handleClick = useCallback(() => onSelect(value!), [value, onSelect]);

  return (
    <Menu.Item
      component={() => (
        <div className={styles.expressionTypeItem} role="menuitem">
          <div className={styles.expressionTypeItemContent} data-testid={`expression-type-${value}`}>
            <Icon className={styles.icon} name={EXPRESSION_ICON_MAP[value!]} aria-hidden="true" />
            {label}
            {value === ExpressionQueryType.sql && <FeatureBadge featureState={FeatureState.new} />}
          </div>
          <Tooltip placement="right" content={description!}>
            <Icon className={styles.infoIcon} name="info-circle" />
          </Tooltip>
        </div>
      )}
      key={value}
      label=""
      onClick={handleClick}
    />
  );
});

ExpressionMenuItem.displayName = 'ExpressionMenuItem';

export const ExpressionTypeDropdown = memo<ExpressionTypeDropdownProps>(({ handleOnSelect, children }) => {
  const menuItems = useMemo(
    () => expressionTypes.map((item) => <ExpressionMenuItem key={item.value} item={item} onSelect={handleOnSelect} />),
    [handleOnSelect]
  );

  const menuOverlay = useMemo(() => <Menu role="menu">{menuItems}</Menu>, [menuItems]);

  return (
    <Dropdown placement="bottom-start" overlay={menuOverlay}>
      {children}
    </Dropdown>
  );
});

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
