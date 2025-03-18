import { cx } from '@emotion/css';
import { RefCallback, SyntheticEvent, useState } from 'react';
import * as React from 'react';
import { lastValueFrom } from 'rxjs';

import { CoreApp, DataFrame, getDefaultTimeRange, SelectableValue, TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AccessoryButton } from '@grafana/experimental';
import {
  HorizontalGroup,
  Select,
  ButtonSelect,
  AsyncMultiSelect,
  getSelectStyles,
  useTheme2,
  Checkbox,
} from '@grafana/ui';

import { AzureMonitorQuery, AzureQueryType, AzureTracesFilter } from '../../dataquery.gen';
import Datasource from '../../datasource';
import { VariableOptionGroup } from '../../types';
import { addValueToOptions } from '../../utils/common';

export interface FilterProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  propertyMap: Map<string, SelectableValue[]>;
  setPropertyMap: React.Dispatch<React.SetStateAction<Map<string, Array<SelectableValue<string>>>>>;
  queryTraceTypes: string[];
  properties: string[];
  variableOptionGroup: VariableOptionGroup;
  range?: TimeRange;
}

const onFieldChange = <Key extends keyof AzureTracesFilter>(
  fieldName: Key,
  item: Partial<AzureTracesFilter>,
  selected: SelectableValue<AzureTracesFilter[Key]>,
  onChange: (item: Partial<AzureTracesFilter>) => void
) => {
  if (fieldName === 'filters') {
    item[fieldName] = selected.map((item: SelectableValue<string>) => item.value);
  } else {
    item[fieldName] = selected.value;
    if (fieldName === 'property') {
      item.filters = [];
    }
  }
  onChange(item);
};

const getTraceProperties = async (
  query: AzureMonitorQuery,
  datasource: Datasource,
  traceTypes: string[],
  propertyMap: Map<string, SelectableValue[]>,
  setPropertyMap: React.Dispatch<React.SetStateAction<Map<string, Array<SelectableValue<string>>>>>,
  filter?: Partial<AzureTracesFilter>,
  range?: TimeRange
): Promise<SelectableValue[]> => {
  const { azureTraces } = query;
  if (!azureTraces) {
    return [];
  }

  const { resources } = azureTraces;

  if (!resources || !filter) {
    return [];
  }

  const property = filter.property;
  if (!property) {
    return [];
  }

  const queryString = `let ${property} = toscalar(union isfuzzy=true ${traceTypes.join(',')}
  | where $__timeFilter(timestamp)
  | summarize count=count() by ${property}
  | summarize make_list(pack_all()));
  print properties = bag_pack("${property}", ${property});`;

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
      range: range || getDefaultTimeRange(),
    })
  );
  if (results.data.length > 0) {
    const result: DataFrame = results.data[0];
    if (result.fields.length > 0) {
      const properties: { [key: string]: Array<{ [key: string]: string | number; count: number }> } = JSON.parse(
        result.fields[0].values.toArray()[0]
      );
      const values = properties[property].map((value) => {
        let label = value[property];
        if (value[property] === '') {
          label = '<Empty>';
        }
        return { label: label.toString(), value: value[property].toString(), count: value.count };
      });
      propertyMap.set(property, values);
      setPropertyMap(propertyMap);
      return values;
    }
  }

  return [];
};

export function makeRenderItem(props: FilterProps) {
  function renderItem(
    item: Partial<AzureTracesFilter>,
    onChange: (item: Partial<AzureTracesFilter>) => void,
    onDelete: () => void
  ) {
    return <Filter {...props} item={item} onChange={onChange} onDelete={onDelete} />;
  }

  return renderItem;
}

interface OptionProps {
  isFocused: boolean;
  isSelected: boolean;
  innerProps: JSX.IntrinsicElements['div'];
  innerRef: RefCallback<HTMLDivElement>;
  data: SelectableValue<string>;
  selectOption: (data: SelectableValue<string>) => void;
}

const Option = (props: React.PropsWithChildren<OptionProps>) => {
  const { data, innerProps, innerRef, isFocused, isSelected } = props;
  const theme = useTheme2();
  const styles = getSelectStyles(theme);

  const onClickMultiOption = (e: SyntheticEvent) => {
    props.selectOption({ ...data });
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div
      ref={innerRef}
      className={cx(
        styles.option,
        isFocused && styles.optionFocused,
        isSelected && styles.optionSelected,
        data.isDisabled && styles.optionDisabled
      )}
      {...innerProps}
      data-testid={selectors.components.Select.option}
      title={data.title}
      onClick={onClickMultiOption}
      onKeyDown={onClickMultiOption}
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
    >
      <div className={styles.optionBody}>
        <Checkbox value={isSelected} label={data.label ? `${data.label} - (${data.count})` : ''} />
      </div>
    </div>
  );
};

const Filter = (
  props: FilterProps & {
    item: Partial<AzureTracesFilter>;
    onChange: (item: Partial<AzureTracesFilter>) => void;
    onDelete: () => void;
  }
) => {
  const {
    query,
    datasource,
    propertyMap,
    setPropertyMap,
    queryTraceTypes,
    properties,
    item,
    onChange,
    onDelete,
    variableOptionGroup,
    range,
  } = props;
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Array<SelectableValue<string> | VariableOptionGroup>>(
    addValueToOptions(propertyMap.get(item.property ?? '') ?? [], variableOptionGroup)
  );
  const [selected, setSelected] = useState<SelectableValue[]>(
    item.filters ? item.filters.map((filter) => ({ value: filter, label: filter === '' ? '<Empty>' : filter })) : []
  );

  const loadOptions = async () => {
    setLoading(true);
    if (item.property && item.property !== '') {
      const vals = propertyMap.get(item.property ?? '');
      if (!vals) {
        const promise = await getTraceProperties(
          query,
          datasource,
          queryTraceTypes,
          propertyMap,
          setPropertyMap,
          item,
          range
        );
        setValues(addValueToOptions(promise, variableOptionGroup));
        setLoading(false);
        return promise;
      } else {
        setValues(addValueToOptions(vals, variableOptionGroup));
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
        options={addValueToOptions(
          properties.map((type) => ({ label: type, value: type })),
          variableOptionGroup
        )}
        onChange={(e) => onFieldChange('property', item, e, onChange)}
        width={25}
      />
      <ButtonSelect<string>
        value={item.operation ? { label: item.operation === 'eq' ? '=' : '!=', value: item.operation } : undefined}
        options={[
          { label: '=', value: 'eq' },
          { label: '!=', value: 'ne' },
        ]}
        onChange={(e) => onFieldChange('operation', item, e, onChange)}
        defaultValue={'eq'}
      />
      <AsyncMultiSelect
        blurInputOnSelect={false}
        menuShouldPortal
        placeholder="Value"
        value={selected}
        loadOptions={loadOptions}
        isLoading={loading}
        onOpenMenu={loadOptions}
        onChange={(e: Array<SelectableValue<string>>) => {
          setSelected(e);
          if (e.length === 0) {
            onFieldChange('filters', item, selected, onChange);
          }
        }}
        width={35}
        defaultOptions={values}
        isClearable
        components={{ Option }}
        closeMenuOnSelect={false}
        onCloseMenu={() => onFieldChange('filters', item, selected, onChange)}
        hideSelectedOptions={false}
      />
      <AccessoryButton aria-label="Remove filter" icon="times" variant="secondary" onClick={onDelete} type="button" />
    </HorizontalGroup>
  );
};

export default Filter;
