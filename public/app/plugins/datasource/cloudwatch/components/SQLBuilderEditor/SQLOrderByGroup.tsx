import React from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { AccessoryButton, EditorField, EditorFieldGroup, InputGroup } from '@grafana/experimental';
import { Select } from '@grafana/ui';

import { CloudWatchDatasource } from '../../datasource';
import { ASC, DESC, STATISTICS } from '../../language/cloudwatch-sql/language';
import { CloudWatchMetricsQuery } from '../../types';
import { appendTemplateVariables } from '../../utils/utils';

import { setOrderBy, setSql } from './utils';

interface SQLBuilderSelectRowProps {
  query: CloudWatchMetricsQuery;
  datasource: CloudWatchDatasource;
  onQueryChange: (query: CloudWatchMetricsQuery) => void;
}

const orderByDirections: Array<SelectableValue<string>> = [
  { label: ASC, value: ASC },
  { label: DESC, value: DESC },
];

const SQLOrderByGroup = ({ query, onQueryChange, datasource }: SQLBuilderSelectRowProps) => {
  const sql = query.sql ?? {};
  const orderBy = sql.orderBy?.name;
  const orderByDirection = sql.orderByDirection;

  return (
    <EditorFieldGroup>
      <EditorField label="Order by" optional width={16}>
        <InputGroup>
          <Select
            aria-label="Order by"
            onChange={({ value }) => value && onQueryChange(setOrderBy(query, value))}
            options={appendTemplateVariables(datasource, STATISTICS.map(toOption))}
            value={orderBy ? toOption(orderBy) : null}
          />
          {orderBy && (
            <AccessoryButton
              aria-label="remove"
              icon="times"
              variant="secondary"
              onClick={() => onQueryChange(setSql(query, { orderBy: undefined }))}
            />
          )}
        </InputGroup>
      </EditorField>

      <EditorField label="Direction" disabled={!orderBy} width={16}>
        <Select
          aria-label="Direction"
          inputId="cloudwatch-sql-order-by-direction"
          value={orderByDirection ? toOption(orderByDirection) : orderByDirections[0]}
          options={appendTemplateVariables(datasource, orderByDirections)}
          onChange={(item) => item && onQueryChange(setSql(query, { orderByDirection: item.value }))}
        />
      </EditorField>
    </EditorFieldGroup>
  );
};

export default SQLOrderByGroup;
