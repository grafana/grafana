import { uniq } from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { EditorList } from '@grafana/plugin-ui';
import { Field } from '@grafana/ui';

import { AzureTracesFilter } from '../../types/query';
import { AzureQueryEditorFieldProps } from '../../types/types';

import { makeRenderItem } from './Filter';
import { tablesSchema } from './consts';
import { setFilters } from './setQueryValue';

const Filters = ({ query, datasource, onQueryChange, variableOptionGroup, range }: AzureQueryEditorFieldProps) => {
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

  useEffect(() => {
    setPropertyMap(new Map<string, Array<SelectableValue<string>>>());
  }, [query.azureTraces?.resources, query.azureTraces?.traceTypes, query.azureTraces?.operationId]);

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
    <Field label={t('components.filters.label-filters', 'Filters')}>
      <EditorList
        items={filters}
        onChange={changedFunc}
        renderItem={makeRenderItem({
          query,
          datasource,
          propertyMap,
          setPropertyMap,
          queryTraceTypes,
          properties,
          variableOptionGroup,
          range,
        })}
      />
    </Field>
  );
};

export default Filters;
