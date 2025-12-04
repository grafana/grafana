import { css } from '@emotion/css';
import { ComponentProps, memo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Dropdown, IconButton, Menu, useStyles2 } from '@grafana/ui';
import { ExpressionQueryType, getExpressionIcon } from 'app/features/expressions/types';

interface AddDataItemMenuProps {
  onAddQuery: (index?: number) => void;
  onAddFromSavedQueries: (index?: number) => void;
  onAddTransform: (index?: number) => void;
  onAddExpression: (type: ExpressionQueryType, index?: number) => void;
  index?: number;
  allowedTypes?: Array<'query' | 'transform' | 'expression'>;
  show?: boolean;
  text?: string;
}

export const AddDataItemMenu = memo(
  ({
    onAddQuery,
    onAddTransform,
    onAddExpression,
    onAddFromSavedQueries,
    index,
    text,
    allowedTypes = ['query', 'expression', 'transform'],
    show = true,
  }: AddDataItemMenuProps) => {
    const styles = useStyles2(getStyles);
    const [menuShown, setMenuShown] = useState(false);

    if (!show && !menuShown) {
      return;
    }

    const renderButton = (onClick?: ComponentProps<typeof Button>['onClick']) => {
      return text ? (
        <Button onClick={onClick} className={styles.textButton} size="md" variant="primary" icon="plus" fill="text">
          {text}
        </Button>
      ) : (
        <IconButton
          onClick={onClick}
          name="plus"
          size="xs"
          variant="primary"
          tooltip={t('dashboard-scene.add-data-item-menu.add-button', 'Add')}
        />
      );
    };

    if (allowedTypes.length === 1 && allowedTypes[0] === 'transform') {
      return renderButton(() => onAddTransform(index));
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
      <Menu.Item key={type} label={label} icon={getExpressionIcon(type)} onClick={() => onAddExpression(type, index)} />
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
        {renderButton()}
      </Dropdown>
    );
  }
);

const getStyles = (theme: GrafanaTheme2) => ({
  textButton: css({
    paddingLeft: 0,
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
});

AddDataItemMenu.displayName = 'AddDataItemMenu';
