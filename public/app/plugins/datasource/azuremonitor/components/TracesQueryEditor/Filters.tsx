import { uniq } from 'lodash';
import React, { useMemo, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { TimeRange, SelectableValue, CoreApp, DataFrame } from '@grafana/data';
import { AccessoryButton, EditorList } from '@grafana/experimental';
import { Field, HorizontalGroup, Select } from '@grafana/ui';

import Datasource from '../../datasource';
import {
  AzureMonitorErrorish,
  AzureMonitorQuery,
  AzureQueryEditorFieldProps,
  AzureQueryType,
  AzureTracesFilter,
} from '../../types';
import { useAsyncState } from '../../utils/useAsyncState';

import { tablesSchema } from './consts';
import { setFilters } from './setQueryValue';

const useTraceProperties = (
  query: AzureMonitorQuery,
  datasource: Datasource,
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void,
  timeRange: TimeRange,
  traceTypes: string[],
  filters: AzureTracesFilter[],
  propertyMap: Map<string, SelectableValue[]>,
  setPropertyMap: React.Dispatch<React.SetStateAction<Map<string, Array<SelectableValue<string>>>>>
): void => {
  const resources = query.azureTraces?.resources;
  useAsyncState(
    async () => {
      const { azureTraces } = query;
      if (!azureTraces) {
        return;
      }

      const { resources } = azureTraces;

      if (!resources || !filters) {
        return;
      }

      let propertiesQuery = ``;
      let bagQuery = '';
      for (const filter of filters) {
        if (filter.property !== '') {
          if (propertyMap.has(filter.property)) {
            continue;
          } else {
            propertiesQuery += `let ${filter.property} = toscalar(union isfuzzy=true ${traceTypes.join(',')}
            | distinct ${filter.property}
            | summarize make_list(${filter.property}));`;
            bagQuery += `"${filter.property}", ${filter.property}`;
          }
        }
      }

      const queryString = `${propertiesQuery}
      print properties = bag_pack(${bagQuery});`;
      if (propertiesQuery !== '') {
        const results = await lastValueFrom(
          datasource.azureLogAnalyticsDatasource.query({
            requestId: 'azure-traces-properties-req',
            interval: '',
            intervalMs: 0,
            scopedVars: {},
            timezone: '',
            startTime: 0,
            app: CoreApp.Unknown,
            targets: [
              {
                ...query,
                azureLogAnalytics: {
                  resources,
                  query: queryString,
                },
                queryType: AzureQueryType.LogAnalytics,
              },
            ],
            range: timeRange,
          })
        );
        if (results.data.length > 0) {
          const result: DataFrame = results.data[0];
          if (result.fields.length > 0) {
            const properties: { [key: string]: string[] } = JSON.parse(result.fields[0].values.toArray()[0]);
            Object.keys(properties).forEach((prop) =>
              propertyMap.set(
                prop,
                properties[prop]
                  .filter((value: string) => value !== '')
                  .map((value: string) => ({ label: value, value }))
              )
            );
            setPropertyMap(propertyMap);
          }
        }
      }
    },
    setError,
    [datasource, resources, query]
  );
};

const Filters = ({ query, datasource, onQueryChange, setError }: AzureQueryEditorFieldProps) => {
  const { azureTraces } = query;
  const queryTraceTypes = azureTraces?.traceTypes ? azureTraces.traceTypes : Object.keys(tablesSchema);

  const excludedProperties = new Set([
    'customDimensions',
    'customMeasurements',
    'details',
    'duration',
    'id',
    'itemId',
    'operation_Id',
    'operation_ParentId',
    'timestamp',
  ]);
  const properties = uniq(queryTraceTypes.map((type) => Object.keys(tablesSchema[type])).flat()).filter(
    (item) => !excludedProperties.has(item)
  );

  const [propertyMap, setPropertyMap] = useState(new Map<string, Array<SelectableValue<string>>>());

  const filters = useMemo(() => query.azureTraces?.filters ?? [], [query.azureTraces?.filters]);
  useTraceProperties(
    query,
    datasource,
    setError,
    datasource.azureLogAnalyticsDatasource.timeSrv.timeRange(),
    queryTraceTypes,
    filters,
    propertyMap,
    setPropertyMap
  );

  const onFieldChange = <Key extends keyof AzureTracesFilter>(
    fieldName: Key,
    item: Partial<AzureTracesFilter>,
    value: AzureTracesFilter[Key],
    onChange: (item: Partial<AzureTracesFilter>) => void
  ) => {
    item[fieldName] = value;
    onChange(item);
  };

  const renderFilters = (
    item: Partial<AzureTracesFilter>,
    onChange: (item: Partial<AzureTracesFilter>) => void,
    onDelete: () => void
  ) => {
    return (
      <HorizontalGroup spacing="none">
        <Select
          menuShouldPortal
          placeholder="Property"
          value={item.property ? { value: item.property, label: item.property } : null}
          options={properties.map((type) => ({ label: type, value: type }))}
          onChange={(e) => onFieldChange('property', item, e.value ?? '', onChange)}
          width={25}
        />
        <Select
          menuShouldPortal
          placeholder="Value"
          value={item.filters ? { value: item.filters[0], label: item.filters[0] } : null}
          options={propertyMap.get(item.property ?? '') ?? []}
          onChange={() => {}}
          width={25}
        />
        <AccessoryButton aria-label="Remove" icon="times" variant="secondary" onClick={onDelete} type="button" />
      </HorizontalGroup>
    );
  };

  const changedFunc = (changed: Array<Partial<AzureTracesFilter>>) => {
    const properData: AzureTracesFilter[] = changed.map((x) => {
      return {
        property: x.property ?? '',
        filters: x.filters ?? [],
        operation: x.operation ?? '',
      };
    });
    onQueryChange(setFilters(query, properData));
  };
  return (
    <Field label="Filters">
      <EditorList items={filters} onChange={changedFunc} renderItem={renderFilters} />
    </Field>
  );
};

export default Filters;
