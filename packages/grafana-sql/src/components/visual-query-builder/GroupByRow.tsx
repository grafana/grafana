import { useCallback } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AccessoryButton, EditorList, InputGroup } from '@grafana/plugin-ui';
import { Select } from '@grafana/ui';

import { QueryEditorGroupByExpression } from '../../expressions';
import { SQLExpression } from '../../types';
import { setGroupByField } from '../../utils/sql.utils';

interface GroupByRowProps {
  sql: SQLExpression;
  onSqlChange: (sql: SQLExpression) => void;
  columns?: Array<SelectableValue<string>>;
}

export function GroupByRow({ sql, columns, onSqlChange }: GroupByRowProps) {
  const onGroupByChange = useCallback(
    (item: Array<Partial<QueryEditorGroupByExpression>>) => {
      // As new (empty object) items come in, we need to make sure they have the correct type
      const cleaned = item.map((v) => setGroupByField(v.property?.name));
      const newSql = { ...sql, groupBy: cleaned };
      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  return (
    <EditorList
      items={sql.groupBy!}
      onChange={onGroupByChange}
      renderItem={makeRenderColumn({
        options: columns,
      })}
    />
  );
}

function makeRenderColumn({ options }: { options?: Array<SelectableValue<string>> }) {
  const renderColumn = function (
    item: Partial<QueryEditorGroupByExpression>,
    onChangeItem: (item: QueryEditorGroupByExpression) => void,
    onDeleteItem: () => void
  ) {
    return (
      <InputGroup>
        <Select
          value={item.property?.name ? toOption(item.property.name) : null}
          aria-label={t('grafana-sql.components.make-render-column.render-column.aria-label-group-by', 'Group by')}
          options={options}
          menuShouldPortal
          onChange={({ value }) => value && onChangeItem(setGroupByField(value))}
        />
        <AccessoryButton
          title={t(
            'grafana-sql.components.make-render-column.render-column.title-remove-group-by-column',
            'Remove group by column'
          )}
          icon="times"
          variant="secondary"
          onClick={onDeleteItem}
        />
      </InputGroup>
    );
  };
  return renderColumn;
}
