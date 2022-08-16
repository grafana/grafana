import React, { useState } from 'react';
import { QueryBuilderComponent, QueryComponent, Component } from './types';
import { QueryBuilderProps } from '../types';
import { InlineField, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { cloneDeep } from 'lodash';

const useComponentsRegistry = (
  components: Record<string, QueryBuilderComponent<QueryComponent | Component>>
): Record<string, QueryBuilderComponent<QueryComponent | Component>> => {
  let registry: Record<string, QueryBuilderComponent<QueryComponent | Component>> = {};
  for (let key of Object.keys(components)) {
    registry[key.toLowerCase()] = components[key];
  }
  return registry;
};

const useComponentKey = (
  builder: any,
  defaultComponent: QueryBuilderComponent<QueryComponent | Component> | undefined = undefined
): string | undefined => {
  let key = builder !== null && typeof builder === 'object' ? builder.type || builder.queryType : undefined;
  if (key === undefined && defaultComponent !== undefined) {
    key =
      'type' in defaultComponent
        ? defaultComponent.type
        : 'queryType' in defaultComponent
        ? defaultComponent.queryType
        : undefined;
  }
  if (key !== undefined) {
    key = key.toLowerCase();
  }
  return key;
};

const useSelectOptions = (
  components: Record<string, QueryBuilderComponent<QueryComponent | Component>>,
  selectedComponentKey: string | undefined
): [SelectableValue<string> | undefined, Array<SelectableValue<string>>] => {
  const options = Object.keys(components).map((key, index) => {
    return { label: key, value: key.toLowerCase() };
  });
  let selectedOption = undefined;
  if (undefined !== selectedComponentKey) {
    const selectedOptions = options.filter((option) => option.value === selectedComponentKey.toLowerCase());
    if (selectedOptions.length > 0) {
      selectedOption = selectedOptions[0];
    }
  }
  return [selectedOption, options];
};

export interface QueryBuilderComponentSelectorProps extends QueryBuilderProps {
  label: string;
  components: Record<string, QueryBuilderComponent<QueryComponent | Component>>;
  default?: QueryBuilderComponent<QueryComponent | Component> | undefined;
}

export const QueryBuilderComponentSelector = (props: QueryBuilderComponentSelectorProps) => {
  const { label, components, ...queryBuilderComponentProps } = props;
  const componentsRegistry = useComponentsRegistry(components);
  const [selectedComponentKey, selectComponentKey] = useState(
    useComponentKey(queryBuilderComponentProps.options.builder, props.default)
  );
  const [selectedOption, options] = useSelectOptions(components, selectedComponentKey);
  const onSelection = (selection: SelectableValue<string>) => {
    let componentKey = undefined;
    if (null === selection) {
      let options = cloneDeep(queryBuilderComponentProps.options);
      options.builder = null;
      queryBuilderComponentProps.onOptionsChange(options);
    } else {
      componentKey = selection.value;
    }
    selectComponentKey(componentKey);
  };
  const Component = selectedComponentKey === undefined ? undefined : componentsRegistry[selectedComponentKey];

  return (
    <>
      <InlineField label={label} grow>
        <Select options={options} value={selectedOption} onChange={onSelection} isClearable={true} />
      </InlineField>
      {Component && <Component {...queryBuilderComponentProps} />}
    </>
  );
};
