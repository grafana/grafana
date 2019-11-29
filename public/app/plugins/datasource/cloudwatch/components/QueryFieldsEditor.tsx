import React, { useState, useEffect } from 'react';
import { SelectableValue } from '@grafana/data';
import { Segment, SegmentAsync } from '@grafana/ui';
import { CloudWatchQuery, SelectableStrings } from '../types';
import CloudWatchDatasource from '../datasource';
import { Stats, Dimensions, QueryInlineField } from './';

export type Props = {
  query: CloudWatchQuery;
  datasource: CloudWatchDatasource;
  onRunQuery?: () => void;
  onChange: (value: CloudWatchQuery) => void;
  hideWilcard?: boolean;
};

interface State {
  regions: SelectableStrings;
  namespaces: SelectableStrings;
  metricNames: SelectableStrings;
  variableOptionGroup: SelectableValue<string>;
  showMeta: boolean;
}

export function QueryFieldsEditor({
  query,
  datasource,
  onChange,
  onRunQuery = () => {},
  hideWilcard = false,
}: React.PropsWithChildren<Props>) {
  const [state, setState] = useState<State>({
    regions: [],
    namespaces: [],
    metricNames: [],
    variableOptionGroup: {},
    showMeta: false,
  });

  useEffect(() => {
    const variableOptionGroup = {
      label: 'Template Variables',
      options: datasource.variables.map(toOption),
    };

    Promise.all([datasource.metricFindQuery('regions()'), datasource.metricFindQuery('namespaces()')]).then(
      ([regions, namespaces]) => {
        setState({
          ...state,
          regions: [...regions, variableOptionGroup],
          namespaces: [...namespaces, variableOptionGroup],
          variableOptionGroup,
        });
      }
    );
  }, []);

  const loadMetricNames = async () => {
    const { namespace, region } = query;
    return datasource.metricFindQuery(`metrics(${namespace},${region})`).then(appendTemplateVariables);
  };

  const appendTemplateVariables = (values: SelectableValue[]) => [
    ...values,
    { label: 'Template Variables', options: datasource.variables.map(toOption) },
  ];

  const toOption = (value: any) => ({ label: value, value });

  const onQueryChange = (query: CloudWatchQuery) => {
    onChange(query);
    onRunQuery();
  };

  const { regions, namespaces, variableOptionGroup } = state;
  return (
    <>
      <QueryInlineField label="Region">
        <Segment
          value={query.region || 'Select region'}
          options={regions}
          allowCustomValue
          onChange={region => onQueryChange({ ...query, region })}
        />
      </QueryInlineField>

      {query.expression.length === 0 && (
        <>
          <QueryInlineField label="Namespace">
            <Segment
              value={query.namespace || 'Select namespace'}
              allowCustomValue
              options={namespaces}
              onChange={namespace => onQueryChange({ ...query, namespace })}
            />
          </QueryInlineField>

          <QueryInlineField label="Metric Name">
            <SegmentAsync
              value={query.metricName || 'Select metric name'}
              allowCustomValue
              loadOptions={loadMetricNames}
              onChange={metricName => onQueryChange({ ...query, metricName })}
            />
          </QueryInlineField>

          <QueryInlineField label="Stats">
            <Stats
              stats={datasource.standardStatistics.map(toOption)}
              values={query.statistics}
              onChange={statistics => onQueryChange({ ...query, statistics })}
              variableOptionGroup={variableOptionGroup}
            />
          </QueryInlineField>

          <QueryInlineField label="Dimensions">
            <Dimensions
              dimensions={query.dimensions}
              onChange={dimensions => onQueryChange({ ...query, dimensions })}
              loadKeys={() => datasource.getDimensionKeys(query.namespace, query.region).then(appendTemplateVariables)}
              loadValues={newKey => {
                const { [newKey]: value, ...newDimensions } = query.dimensions;
                return datasource
                  .getDimensionValues(query.region, query.namespace, query.metricName, newKey, newDimensions)
                  .then(values =>
                    values.length && !hideWilcard ? [{ value: '*', text: '*', label: '*' }, ...values] : values
                  )
                  .then(appendTemplateVariables);
              }}
            />
          </QueryInlineField>
        </>
      )}
    </>
  );
}
