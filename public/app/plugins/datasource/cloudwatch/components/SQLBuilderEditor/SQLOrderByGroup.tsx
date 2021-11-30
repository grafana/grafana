import { SelectableValue, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';
import React from 'react';
import { ASC, DESC, STATISTICS } from '../../cloudwatch-sql/language';
import { CloudWatchDatasource } from '../../datasource';
import { CloudWatchMetricsQuery } from '../../types';
import { appendTemplateVariables } from '../../utils/utils';
import AccessoryButton from '../ui/AccessoryButton';
import EditorField from '../ui/EditorField';
import EditorFieldGroup from '../ui/EditorFieldGroup';
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

const SQLOrderByGroup: React.FC<SQLBuilderSelectRowProps> = ({ query, onQueryChange, datasource }) => {
  const sql = query.sql ?? {};
  const orderBy = sql.orderBy?.name;
  const orderByDirection = sql.orderByDirection;

  return (
    <EditorFieldGroup>
      <EditorField label="Order by" optional width={16}>
        <>
          <Select
            onChange={({ value }) => value && onQueryChange(setOrderBy(query, value))}
            options={appendTemplateVariables(datasource, STATISTICS.map(toOption))}
            value={orderBy ? toOption(orderBy) : null}
            menuShouldPortal
          />
          {orderBy && (
            <AccessoryButton
              aria-label="remove"
              icon="times"
              variant="secondary"
              onClick={() => onQueryChange(setSql(query, { orderBy: undefined }))}
            />
          )}
        </>
      </EditorField>

      <EditorField label="Direction" width={16}>
        <Select
          inputId="cloudwatch-sql-order-by-direction"
          disabled={!orderBy}
          value={orderByDirection ? toOption(orderByDirection) : orderByDirections[0]}
          options={appendTemplateVariables(datasource, orderByDirections)}
          onChange={(item) => item && onQueryChange(setSql(query, { orderByDirection: item.value }))}
          menuShouldPortal
        />
      </EditorField>
    </EditorFieldGroup>
  );
};

export default SQLOrderByGroup;
