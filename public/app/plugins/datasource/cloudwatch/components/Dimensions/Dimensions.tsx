import { isEqual } from 'lodash';
import React, { useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorList } from '@grafana/experimental';

import { CloudWatchDatasource } from '../../datasource';
import { Dimensions as DimensionsType, MetricStat } from '../../types';

import { FilterItem } from './FilterItem';

export interface Props {
  metricStat: MetricStat;
  onChange: (dimensions: DimensionsType) => void;
  datasource: CloudWatchDatasource;
  dimensionKeys: Array<SelectableValue<string>>;
  disableExpressions: boolean;
}

export interface DimensionFilterCondition {
  key?: string;
  operator?: string;
  value?: string;
}

const dimensionsToFilterConditions = (dimensions: DimensionsType | undefined) =>
  Object.entries(dimensions ?? {}).reduce<DimensionFilterCondition[]>((acc, [key, value]) => {
    if (!value) {
      return acc;
    }

    // Previously, we only appended to the `acc`umulated dimensions if the value was a string.
    // However, Cloudwatch can present dimensions with single-value arrays, e.g.
    //   k: FunctionName
    //   v: ['MyLambdaFunction']
    // in which case we grab the single-value from the Array and use that as the value.
    let v = '';
    if (typeof value === 'string') {
      v = value;
    } else if (Array.isArray(value) && typeof value[0] === 'string') {
      v = value[0];
    }

    if (!v) {
      return acc;
    }

    const filter = {
      key: key,
      value: v,
      operator: '=',
    };
    return [...acc, filter];
  }, []);

const filterConditionsToDimensions = (filters: DimensionFilterCondition[]) => {
  return filters.reduce<DimensionsType>((acc, { key, value }) => {
    if (key && value) {
      return { ...acc, [key]: value };
    }
    return acc;
  }, {});
};

export const Dimensions = ({ metricStat, datasource, dimensionKeys, disableExpressions, onChange }: Props) => {
  const dimensionFilters = useMemo(() => dimensionsToFilterConditions(metricStat.dimensions), [metricStat.dimensions]);
  const [items, setItems] = useState<DimensionFilterCondition[]>(dimensionFilters);
  const onDimensionsChange = (newItems: Array<Partial<DimensionFilterCondition>>) => {
    setItems(newItems);

    // The onChange event should only be triggered in the case there is a complete dimension object.
    // So when a new key is added that does not yet have a value, it should not trigger an onChange event.
    const newDimensions = filterConditionsToDimensions(newItems);
    if (!isEqual(newDimensions, metricStat.dimensions)) {
      onChange(newDimensions);
    }
  };

  return (
    <EditorList
      items={items}
      onChange={onDimensionsChange}
      renderItem={makeRenderFilter(datasource, metricStat, dimensionKeys, disableExpressions)}
    />
  );
};

function makeRenderFilter(
  datasource: CloudWatchDatasource,
  metricStat: MetricStat,
  dimensionKeys: Array<SelectableValue<string>>,
  disableExpressions: boolean
) {
  function renderFilter(
    item: DimensionFilterCondition,
    onChange: (item: DimensionFilterCondition) => void,
    onDelete: () => void
  ) {
    return (
      <FilterItem
        filter={item}
        onChange={(item) => onChange(item)}
        datasource={datasource}
        metricStat={metricStat}
        disableExpressions={disableExpressions}
        dimensionKeys={dimensionKeys}
        onDelete={onDelete}
      />
    );
  }

  return renderFilter;
}
