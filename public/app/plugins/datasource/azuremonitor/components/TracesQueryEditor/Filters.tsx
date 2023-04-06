import { uniq } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';

import { TimeRange, SelectableValue, CoreApp, DataFrame } from '@grafana/data';
import { AccessoryButton, EditorList } from '@grafana/experimental';
import { AsyncSelect, Field, HorizontalGroup, Select } from '@grafana/ui';

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

const getTraceProperties = async (
  query: AzureMonitorQuery,
  datasource: Datasource,
  timeRange: TimeRange,
  traceTypes: string[],
  propertyMap: Map<string, SelectableValue[]>,
  setPropertyMap: React.Dispatch<React.SetStateAction<Map<string, Array<SelectableValue<string>>>>>,
  filter?: Partial<AzureTracesFilter>
): Promise<SelectableValue[]> => {
  const { azureTraces } = query;
  if (!azureTraces) {
    return [];
  }

  const { resources } = azureTraces;

  if (!resources || !filter) {
    return [];
  }

  if (!filter.property) {
    return [];
  }

  const queryString = `let ${filter.property} = toscalar(union isfuzzy=true ${traceTypes.join(',')}
  | distinct ${filter.property}
  | summarize make_list(${filter.property}));
      print properties = bag_pack("${filter.property}", ${filter.property});`;

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
      const values = properties[filter.property]
        .filter((value: string) => value !== '')
        .map((value: string) => ({ label: value, value }));
      propertyMap.set(filter.property, values);
      setPropertyMap(propertyMap);
      return values;
    }
  }

  return [];
};

const Filters = ({ query, datasource, onQueryChange, setError }: AzureQueryEditorFieldProps) => {
  const { azureTraces } = query;
  const timeRange = datasource.azureLogAnalyticsDatasource.timeSrv.timeRange();
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

  const onFieldChange = <Key extends keyof AzureTracesFilter>(
    fieldName: Key,
    item: Partial<AzureTracesFilter>,
    value: AzureTracesFilter[Key],
    onChange: (item: Partial<AzureTracesFilter>) => void
  ) => {
    item[fieldName] = value;
    onChange(item);
  };

  const RenderFilters = (
    item: Partial<AzureTracesFilter>,
    onChange: (item: Partial<AzureTracesFilter>) => void,
    onDelete: () => void
  ) => {
    const [loading, setLoading] = useState(false);
    const [values, setValues] = useState(propertyMap.get(item.property ?? ''));
    const value = () => {
      if (item.property && values) {
        const exists = values.find((val) => item.property === val.value);
        if (!exists) {
          return undefined;
        } else {
          return exists;
        }
      }
      return undefined;
    };

    const loadOptions = async () => {
      setLoading(true);
      if (item.property && item.property !== '') {
        const vals = propertyMap.get(item.property);
        if (!vals) {
          const promise = await getTraceProperties(
            query,
            datasource,
            timeRange,
            queryTraceTypes,
            propertyMap,
            setPropertyMap,
            item
          );
          setValues(promise);
          setLoading(false);
          return promise;
        } else {
          setValues(vals);
          setLoading(false);
          return Promise.resolve(vals);
        }
      }
      const empty: Array<SelectableValue<string>> = [];
      return Promise.resolve(empty);
    };

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
        <AsyncSelect
          menuShouldPortal
          placeholder="Value"
          //   value={value()}
          loadOptions={loadOptions}
          isLoading={loading}
          onOpenMenu={loadOptions}
          onChange={() => {}}
          width={25}
          defaultOptions={values}
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
      <EditorList items={filters} onChange={changedFunc} renderItem={RenderFilters} />
    </Field>
  );
};

export default Filters;
