import { memo, useState } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Dropdown, IconButton, Menu } from '@grafana/ui';
import { EXPRESSION_ICON_MAP } from 'app/features/expressions/consts';
import { ExpressionQueryType } from 'app/features/expressions/types';

interface AddDataItemMenuProps {
  onAddQuery: (index?: number) => void;
  onAddFromSavedQueries: (index?: number) => void;
  onAddTransform: (index?: number) => void;
  onAddExpression: (type: ExpressionQueryType, index?: number) => void;
  index?: number;
  allowedTypes?: Array<'query' | 'transform' | 'expression'>;
  show?: boolean;
}

export const AddDataItemMenu = memo(
  ({
    onAddQuery,
    onAddTransform,
    onAddExpression,
    onAddFromSavedQueries,
    index,
    allowedTypes = ['query', 'expression', 'transform'],
    show = true,
  }: AddDataItemMenuProps) => {
    const [menuShown, setMenuShown] = useState(false);

    if (!show && !menuShown) {
      return;
    }

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
      <Menu.Item
        key={type}
        label={label}
        icon={EXPRESSION_ICON_MAP[type]}
        onClick={() => onAddExpression(type, index)}
      />
    ));

    const menu = (
      <Menu>
        {allowedTypes.includes('query') && (
          <Menu.Item
            label={t('dashboard-scene.add-data-item-menu.add-query', 'Query')}
            icon="database"
            onClick={() => onAddQuery(index)}
          />
        )}
        {allowedTypes.includes('query') && (
          <Menu.Item
            label={t('dashboard-scene.add-data-item-menu.add-from-saved-queries', 'From saved queries')}
            icon="bookmark"
            onClick={() => onAddFromSavedQueries(index)}
          />
        )}
        {allowedTypes.includes('transform') && (
          <Menu.Item
            label={t('dashboard-scene.add-data-item-menu.add-transformation', 'Transformation')}
            icon="process"
            onClick={() => onAddTransform(index)}
          />
        )}

        {allowedTypes.includes('expression') && (
          <Menu.Item
            label={t('dashboard-scene.add-data-item-menu.expressions-group', 'Expression')}
            icon="calculator-alt"
            childItems={expressionSubItems}
          />
        )}
      </Menu>
    );

    return (
      <Dropdown overlay={menu} placement="top-end" onVisibleChange={(shown) => setMenuShown(shown)}>
        <IconButton name="plus" size="xs" variant="primary" tooltip={t('dashboard-scene.add-data-item-menu.add-button', 'Add')} />
      </Dropdown>
    );
  }
);

AddDataItemMenu.displayName = 'AddDataItemMenu';
