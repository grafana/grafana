import React, { FC, useState, useMemo } from 'react';
import _ from 'lodash';

import { SelectableValue } from '@grafana/data';
import { Segment, Icon } from '@grafana/ui';
import { getAggregationOptionsByMetric } from '../functions';
import { ValueTypes, MetricKind } from '../constants';

export interface Props {
  onChange: (metricDescriptor: string) => void;
  metricDescriptor: {
    valueType: string;
    metricKind: string;
  };
  crossSeriesReducer: string;
  groupBys: string[];
  children?: (renderProps: any) => JSX.Element;
  templateVariableOptions: Array<SelectableValue<string>>;
}

export const Aggregations: FC<Props> = props => {
  const [displayAdvancedOptions, setDisplayAdvancedOptions] = useState(false);
  const aggOptions = useAggregationOptionsByMetric(props);
  const selected = useSelectedFromOptions(aggOptions, props);

  return (
    <>
      <div className="gf-form-inline">
        <label className="gf-form-label query-keyword width-9">Aggregation</label>
        <Segment
          onChange={({ value }) => props.onChange(value)}
          value={selected}
          options={[
            {
              label: 'Template Variables',
              options: props.templateVariableOptions,
            },
            {
              label: 'Aggregations',
              expanded: true,
              options: aggOptions,
            },
          ]}
          placeholder="Select Reducer"
        ></Segment>
        <div className="gf-form gf-form--grow">
          <label className="gf-form-label gf-form-label--grow">
            <a onClick={() => setDisplayAdvancedOptions(!displayAdvancedOptions)}>
              <>
                <Icon name={displayAdvancedOptions ? 'angle-down' : 'angle-right'} /> Advanced Options
              </>
            </a>
          </label>
        </div>
      </div>
      {props.children(displayAdvancedOptions)}
    </>
  );
};

const useAggregationOptionsByMetric = ({ metricDescriptor }: Props): Array<SelectableValue<string>> => {
  return useMemo(() => {
    if (!metricDescriptor) {
      return [];
    }

    return getAggregationOptionsByMetric(
      metricDescriptor.valueType as ValueTypes,
      metricDescriptor.metricKind as MetricKind
    ).map(a => ({
      ...a,
      label: a.text,
    }));
  }, [metricDescriptor?.metricKind, metricDescriptor?.valueType]);
};

const useSelectedFromOptions = (aggOptions: Array<SelectableValue<string>>, props: Props) => {
  return useMemo(() => {
    const allOptions = [...aggOptions, ...props.templateVariableOptions];
    return allOptions.find(s => s.value === props.crossSeriesReducer);
  }, [aggOptions, props.crossSeriesReducer, props.templateVariableOptions]);
};
