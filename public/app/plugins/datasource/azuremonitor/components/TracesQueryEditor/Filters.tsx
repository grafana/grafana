import { uniq } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';

import { SelectableValue, TimeRange } from '@grafana/data';
import { EditorList } from '@grafana/experimental';
import { Field } from '@grafana/ui';

import { AzureQueryEditorFieldProps, AzureTracesFilter } from '../../types';

import { makeRenderItem } from './Filter';
import { tablesSchema } from './consts';
import { setFilters } from './setQueryValue';

const Filters = ({ query, datasource, onQueryChange, variableOptionGroup }: AzureQueryEditorFieldProps) => {
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
  const queryFilters = useMemo(() => query.azureTraces?.filters ?? [], [query.azureTraces?.filters]);
  const [filters, updateFilters] = useState(queryFilters);

  const timeSrv = datasource.azureLogAnalyticsDatasource.timeSrv;
  const [timeRange, setTimeRange] = useState(timeSrv.timeRange());

  const useTime = (time: TimeRange) => {
    if (
      timeRange !== null &&
      (timeRange.raw.from.toString() !== time.raw.from.toString() ||
        timeRange.raw.to.toString() !== time.raw.to.toString())
    ) {
      setTimeRange({ ...time });
    }
  };
  useTime(timeSrv.timeRange());

  useEffect(() => {
    setPropertyMap(new Map<string, Array<SelectableValue<string>>>());
  }, [timeRange, query.azureTraces?.resources, query.azureTraces?.traceTypes, query.azureTraces?.operationId]);

  const changedFunc = (changed: Array<Partial<AzureTracesFilter>>) => {
    let updateQuery = false;
    const properData: AzureTracesFilter[] = changed.map((x) => {
      if (x.property !== '' && x.filters && x.filters.length > 0 && x.operation !== '') {
        updateQuery = true;
      } else {
        updateQuery = false;
      }
      return {
        property: x.property ?? '',
        filters: x.filters ?? [],
        operation: x.operation ?? 'eq',
      };
    });
    updateFilters(properData);
    if (updateQuery || (queryFilters.length > 0 && properData.length === 0)) {
      onQueryChange(setFilters(query, properData));
    }
  };

  return (
    <Field label="Filters">
      <EditorList
        items={filters}
        onChange={changedFunc}
        renderItem={makeRenderItem({
          query,
          datasource,
          propertyMap,
          setPropertyMap,
          timeRange,
          queryTraceTypes,
          properties,
          variableOptionGroup,
        })}
      />
    </Field>
  );
};

export default Filters;
