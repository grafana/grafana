import { useMemo, useState } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { AccessoryButton, EditorList, InputGroup } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Select } from '@grafana/ui';

import { CloudWatchDatasource } from '../../../../datasource';
import {
  QueryEditorExpressionType,
  QueryEditorGroupByExpression,
  QueryEditorPropertyType,
} from '../../../../expressions';
import { useDimensionKeys, useIsMonitoringAccount } from '../../../../hooks';
import { CloudWatchMetricsQuery } from '../../../../types';

import {
  getFlattenedGroupBys,
  getMetricNameFromExpression,
  getNamespaceFromExpression,
  setGroupByField,
  setSql,
} from './utils';

interface SQLGroupByProps {
  query: CloudWatchMetricsQuery;
  datasource: CloudWatchDatasource;
  onQueryChange: (query: CloudWatchMetricsQuery) => void;
}

const SQLGroupBy = ({ query, datasource, onQueryChange }: SQLGroupByProps) => {
  const sql = query.sql ?? {};
  const groupBysFromQuery = useMemo(() => getFlattenedGroupBys(query.sql ?? {}), [query.sql]);
  const [items, setItems] = useState<QueryEditorGroupByExpression[]>(groupBysFromQuery);
  const isMonitoringAccount = useIsMonitoringAccount(datasource.resources, query.region);

  const namespace = getNamespaceFromExpression(sql.from);
  const metricName = getMetricNameFromExpression(sql.select);

  const baseOptions = useDimensionKeys(datasource, { region: query.region, namespace, metricName });
  const options = useMemo(
    // Exclude options we've already selected
    () => {
      const isCrossAccountEnabled = config.featureToggles.cloudWatchCrossAccountQuerying;

      const baseOptionsWithAccountId =
        isCrossAccountEnabled && isMonitoringAccount
          ? [{ label: 'Account ID', value: 'AWS.AccountId' }, ...baseOptions]
          : baseOptions;
      return baseOptionsWithAccountId.filter(
        (option) => !groupBysFromQuery.some((v) => v.property.name === option.value)
      );
    },
    [baseOptions, groupBysFromQuery, isMonitoringAccount]
  );

  const onChange = (newItems: Array<Partial<QueryEditorGroupByExpression>>) => {
    // As new (empty object) items come in, with need to make sure they have the correct type
    const cleaned = newItems.map(
      (v): QueryEditorGroupByExpression => ({
        type: QueryEditorExpressionType.GroupBy,
        property: {
          type: QueryEditorPropertyType.String,
          name: v.property?.name,
        },
      })
    );

    setItems(cleaned);

    // Only save complete expressions into the query state;
    const completeExpressions = cleaned.filter((v) => v.property?.name);

    const groupBy = completeExpressions.length
      ? {
          type: QueryEditorExpressionType.And as const,
          expressions: completeExpressions,
        }
      : undefined;

    onQueryChange(setSql(query, { groupBy }));
  };

  return <EditorList items={items} onChange={onChange} renderItem={makeRenderItem(options)} />;
};

function makeRenderItem(options: Array<SelectableValue<string>>) {
  function renderItem(
    item: Partial<QueryEditorGroupByExpression>,
    onChange: (item: QueryEditorGroupByExpression) => void,
    onDelete: () => void
  ) {
    return <GroupByItem options={options} item={item} onChange={onChange} onDelete={onDelete} />;
  }

  return renderItem;
}

interface GroupByItemProps {
  options: Array<SelectableValue<string>>;
  item: Partial<QueryEditorGroupByExpression>;
  onChange: (item: QueryEditorGroupByExpression) => void;
  onDelete: () => void;
}

const GroupByItem = (props: GroupByItemProps) => {
  const { options, item, onChange, onDelete } = props;
  const fieldName = item.property?.name;

  return (
    <InputGroup>
      <Select
        aria-label={`Group by ${fieldName ?? 'filter key'}`}
        width="auto"
        value={fieldName ? toOption(fieldName) : null}
        options={options}
        allowCustomValue
        onChange={({ value }) => value && onChange(setGroupByField(value))}
      />

      <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
    </InputGroup>
  );
};

export default SQLGroupBy;
