import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Dropdown, IconButton, Menu, Stack, useStyles2 } from '@grafana/ui';
import { ExpressionQueryType } from 'app/features/expressions/types';

interface AddDataItemMenuProps {
  onAddQuery: () => void;
  onAddTransform: () => void;
  onAddExpression: (type: ExpressionQueryType) => void;
}

export const AddDataItemMenu = memo(({ onAddQuery, onAddTransform, onAddExpression }: AddDataItemMenuProps) => {
  const styles = useStyles2(getStyles);

  const expressionTypes = [
    { type: ExpressionQueryType.math, label: t('dashboard-scene.add-data-item-menu.expression-math', 'Math') },
    { type: ExpressionQueryType.reduce, label: t('dashboard-scene.add-data-item-menu.expression-reduce', 'Reduce') },
    {
      type: ExpressionQueryType.resample,
      label: t('dashboard-scene.add-data-item-menu.expression-resample', 'Resample'),
    },
    {
      type: ExpressionQueryType.classic,
      label: t('dashboard-scene.add-data-item-menu.expression-classic', 'Classic condition'),
    },
    {
      type: ExpressionQueryType.threshold,
      label: t('dashboard-scene.add-data-item-menu.expression-threshold', 'Threshold'),
    },
  ];

  // Add SQL if feature flag is enabled
  if (config.featureToggles.sqlExpressions) {
    expressionTypes.push({
      type: ExpressionQueryType.sql,
      label: t('dashboard-scene.add-data-item-menu.expression-sql', 'SQL'),
    });
  }

  const expressionSubItems = expressionTypes.map(({ type, label }) => (
    <Menu.Item key={type} label={label} icon="calculator-alt" onClick={() => onAddExpression(type)} />
  ));

  const menu = (
    <Menu>
      <Menu.Item
        label={t('dashboard-scene.add-data-item-menu.add-query', 'Query')}
        icon="database"
        onClick={onAddQuery}
      />
      <Menu.Item
        label={t('dashboard-scene.add-data-item-menu.add-transformation', 'Transformation')}
        icon="process"
        onClick={onAddTransform}
      />
      <Menu.Item
        label={t('dashboard-scene.add-data-item-menu.expressions-group', 'Expression')}
        icon="calculator-alt"
        childItems={expressionSubItems}
      />
    </Menu>
  );

  return (
    <Stack direction="row" justifyContent="center" alignItems="center">
      <Dropdown overlay={menu} placement="top-start">
        <IconButton
          name="plus-circle"
          size="xxl"
          variant="secondary"
          tooltip={t('dashboard-scene.add-data-item-menu.add-button', 'Add')}
        />
      </Dropdown>
    </Stack>
  );
});

AddDataItemMenu.displayName = 'AddDataItemMenu';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      width: '100%',
    }),
  };
};
