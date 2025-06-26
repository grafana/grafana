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
} as const;

export const ExpressionTypeDropdown = memo(
  ({ handleOnSelect, children }: { handleOnSelect: (value: ExpressionQueryType) => void; children: ReactElement }) => {
    const styles = useStyles2(getStyles);

    const renderMenuItem = useCallback(
      ({ description, label, value }: SelectableValue<ExpressionQueryType>) => {
        return (
          <Menu.Item
            component={() => (
              <div className={styles.expressionTypeItem}>
                <div className={styles.expressionTypeItemContent} data-testid={`expression-type-${value}`}>
                  <Icon className={styles.icon} name={EXPRESSION_ICON_MAP[value!]} />
                  {label}
                  {value === 'sql' && <FeatureBadge featureState={FeatureState.new} />}
                </div>
                <Tooltip placement="right" content={description!}>
                  <Icon name="info-circle" className={styles.icon} />
                </Tooltip>
              </div>
            )}
            key={value}
            label=""
            onClick={() => handleOnSelect(value!)}
          />
        );
      },
      [styles, handleOnSelect]
    );

    const menuItems = useMemo(() => expressionTypes.map(renderMenuItem), [renderMenuItem]);
    const menuOverlay = useMemo(() => <Menu>{menuItems}</Menu>, [menuItems]);

    return (
      <Dropdown placement="bottom-start" overlay={menuOverlay}>
        {children}
      </Dropdown>
    );
  }
);

ExpressionTypeDropdown.displayName = 'ExpressionTypeDropdown';

const getStyles = (theme: GrafanaTheme2) => ({
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
  description: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    textAlign: 'start',
  }),
  icon: css({
    opacity: 0.7,
    color: theme.colors.text.secondary,
  }),
});
