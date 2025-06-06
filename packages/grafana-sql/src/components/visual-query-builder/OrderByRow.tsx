import { uniqueId } from 'lodash';
import { useCallback } from 'react';
import * as React from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { EditorField, InputGroup } from '@grafana/plugin-ui';
import { Input, RadioButtonGroup, Select, Space } from '@grafana/ui';

import { SQLExpression } from '../../types';
import { setPropertyField } from '../../utils/sql.utils';

type OrderByRowProps = {
  sql: SQLExpression;
  onSqlChange: (sql: SQLExpression) => void;
  columns?: Array<SelectableValue<string>>;
  showOffset?: boolean;
};

const sortOrderOptions = [
  { description: 'Sort by ascending', value: 'ASC', icon: 'sort-amount-up' } as const,
  { description: 'Sort by descending', value: 'DESC', icon: 'sort-amount-down' } as const,
];

export function OrderByRow({ sql, onSqlChange, columns, showOffset }: OrderByRowProps) {
  const onSortOrderChange = useCallback(
    (item: 'ASC' | 'DESC') => {
      const newSql: SQLExpression = { ...sql, orderByDirection: item };
      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  const onLimitChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newSql: SQLExpression = { ...sql, limit: Number.parseInt(event.currentTarget.value, 10) };
      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  const onOffsetChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newSql: SQLExpression = { ...sql, offset: Number.parseInt(event.currentTarget.value, 10) };
      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  const onOrderByChange = useCallback(
    (item: SelectableValue<string>) => {
      const newSql: SQLExpression = { ...sql, orderBy: setPropertyField(item?.value) };
      if (item === null) {
        newSql.orderByDirection = undefined;
      }
      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  return (
    <>
      <EditorField label="Order by" width={25}>
        <InputGroup>
          <Select
            aria-label="Order by"
            options={columns}
            value={sql.orderBy?.property.name ? toOption(sql.orderBy.property.name) : null}
            isClearable
            menuShouldPortal
            onChange={onOrderByChange}
          />

          <Space h={1.5} />

          <RadioButtonGroup
            options={sortOrderOptions}
            disabled={!sql?.orderBy?.property.name}
            value={sql.orderByDirection}
            onChange={onSortOrderChange}
          />
        </InputGroup>
      </EditorField>
      <EditorField label="Limit" optional width={25}>
        <Input type="number" min={0} id={uniqueId('limit-')} value={sql.limit || ''} onChange={onLimitChange} />
      </EditorField>
      {showOffset && (
        <EditorField label="Offset" optional width={25}>
          <Input type="number" id={uniqueId('offset-')} value={sql.offset || ''} onChange={onOffsetChange} />
        </EditorField>
      )}
    </>
  );
}
