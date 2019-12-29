import React, { FC, useState } from 'react';
import memoizeOne from 'memoize-one';
import _ from 'lodash';

import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { getAggregationOptionsByMetric } from '../functions';
import { ValueTypes, MetricKind } from '../constants';

export interface Props {
  onChange: (metricDescriptor: any) => void;
  metricDescriptor: {
    valueType: string;
    metricKind: string;
  };
  crossSeriesReducer: string;
  groupBys: string[];
  children?: (renderProps: any) => JSX.Element;
  templateVariableOptions: Array<SelectableValue<string>>;
}

export const setAggOptions = memoizeOne((valueType: ValueTypes, metricKind: MetricKind) => {
  return {
    label: 'Aggregations',
    expanded: true,
    options: getAggregationOptionsByMetric(valueType, metricKind).map(a => ({
      ...a,
      label: a.text,
    })),
  };
});

export const Aggregations: FC<Props> = ({ templateVariableOptions, onChange, crossSeriesReducer, metricDescriptor, children }) => {
  const [displayAdvancedOptions, setDisplayAdvancedOptions] = useState(false);

  const aggOptions = metricDescriptor
    ? [setAggOptions(metricDescriptor.valueType as ValueTypes, metricDescriptor.metricKind as MetricKind)]
    : [] as any;
  return (
    <>
      <div className="gf-form-inline">
        <label className="gf-form-label query-keyword width-9">Aggregation</label>
        <Segment
          onChange={({ value }) => onChange(value)}
          value={[...aggOptions, ...templateVariableOptions].find(s => s.value === crossSeriesReducer)}
          options={[
            {
              label: 'Template Variables',
              options: templateVariableOptions,
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
                <i className={`fa fa-caret-${displayAdvancedOptions ? 'down' : 'right'}`} /> Advanced Options
              </>
            </a>
          </label>
        </div>
      </div>
      {children(displayAdvancedOptions)}
    </>
  );
};
