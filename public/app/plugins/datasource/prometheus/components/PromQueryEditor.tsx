import { map } from 'lodash';
import React, { PureComponent } from 'react';

// Types
import { InlineFormLabel, LegacyForms, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { PromQuery, StepMode } from '../types';

import PromQueryField from './PromQueryField';
import PromLink from './PromLink';
import { PromExemplarField } from './PromExemplarField';
import { PromQueryEditorProps } from './types';

const { Switch } = LegacyForms;

const FORMAT_OPTIONS: Array<SelectableValue<string>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
  { label: 'Heatmap', value: 'heatmap' },
];

const INTERVAL_FACTOR_OPTIONS: Array<SelectableValue<number>> = map([1, 2, 3, 4, 5, 10], (value: number) => ({
  value,
  label: '1/' + value,
}));

export const DEFAULT_STEP_MODE: SelectableValue<StepMode> = {
  value: 'min',
  label: 'Minimum',
};

export const STEP_MODES: Array<SelectableValue<StepMode>> = [
  DEFAULT_STEP_MODE,
  {
    value: 'max',
    label: 'Maximum',
  },
  {
    value: 'exact',
    label: 'Exact',
  },
];

interface State {
  legendFormat?: string;
  formatOption: SelectableValue<string>;
  interval?: string;
  intervalFactorOption: SelectableValue<number>;
  stepMode: SelectableValue<StepMode>;
  instant: boolean;
  exemplar: boolean;
}

export class PromQueryEditor extends PureComponent<PromQueryEditorProps, State> {
  // Query target to be modified and used for queries
  query: PromQuery;

  constructor(props: PromQueryEditorProps) {
    super(props);
    // Use default query to prevent undefined input values
    const defaultQuery: Partial<PromQuery> = {
      expr: '',
      legendFormat: '',
      interval: '',
      exemplar: true,
      stepMode: DEFAULT_STEP_MODE.value,
    };
    const query = Object.assign({}, defaultQuery, props.query);
    this.query = query;
    // Query target properties that are fully controlled inputs
    this.state = {
      // Fully controlled text inputs
      interval: query.interval,
      legendFormat: query.legendFormat,
      // Select options
      formatOption: FORMAT_OPTIONS.find((option) => option.value === query.format) || FORMAT_OPTIONS[0],
      intervalFactorOption:
        INTERVAL_FACTOR_OPTIONS.find((option) => option.value === query.intervalFactor) || INTERVAL_FACTOR_OPTIONS[0],
      // Step mode
      stepMode: STEP_MODES.find((option) => option.value === query.stepMode) || DEFAULT_STEP_MODE,
      // Switch options
      instant: Boolean(query.instant),
      exemplar: Boolean(query.exemplar),
    };
  }

  onFieldChange = (query: PromQuery, override?: any) => {
    this.query.expr = query.expr;
  };

  onFormatChange = (option: SelectableValue<string>) => {
    this.query.format = option.value;
    this.setState({ formatOption: option }, this.onRunQuery);
  };

  onInstantChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const instant = (e.target as HTMLInputElement).checked;
    this.query.instant = instant;
    this.setState({ instant }, this.onRunQuery);
  };

  onIntervalChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const interval = e.currentTarget.value;
    this.query.interval = interval;
    this.setState({ interval });
  };

  onIntervalFactorChange = (option: SelectableValue<number>) => {
    this.query.intervalFactor = option.value;
    this.setState({ intervalFactorOption: option }, this.onRunQuery);
  };

  onStepChange = (option: SelectableValue<StepMode>) => {
    this.query.stepMode = option.value;
    this.setState({ stepMode: option }, this.onRunQuery);
  };

  onLegendChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const legendFormat = e.currentTarget.value;
    this.query.legendFormat = legendFormat;
    this.setState({ legendFormat });
  };

  onExemplarChange = (isEnabled: boolean) => {
    this.query.exemplar = isEnabled;
    this.setState({ exemplar: isEnabled }, this.onRunQuery);
  };

  onRunQuery = () => {
    const { query } = this;
    // Change of query.hide happens outside of this component and is just passed as prop. We have to update it when running queries.
    const { hide } = this.props.query;
    this.props.onChange({ ...query, hide });
    this.props.onRunQuery();
  };

  render() {
    const { datasource, query, range, data } = this.props;
    const { formatOption, instant, interval, intervalFactorOption, stepMode, legendFormat, exemplar } = this.state;

    return (
      <PromQueryField
        datasource={datasource}
        query={query}
        range={range}
        onRunQuery={this.onRunQuery}
        onChange={this.onFieldChange}
        history={[]}
        data={data}
        data-testid={testIds.editor}
        ExtraFieldElement={
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel
                width={7}
                tooltip="Controls the name of the time series, using name or pattern. For example
        {{hostname}} will be replaced with label value for the label hostname."
              >
                Legend
              </InlineFormLabel>
              <input
                type="text"
                className="gf-form-input"
                placeholder="legend format"
                value={legendFormat}
                onChange={this.onLegendChange}
                onBlur={this.onRunQuery}
              />
            </div>

            <div className="gf-form">
              <InlineFormLabel
                width={5}
                tooltip={
                  <>
                    Use &apos;Minimum&apos; or &apos;Maximum&apos; step mode to set the lower or upper bounds
                    respectively on the interval between data points. For example, set &quot;minimum 1h&quot; to hint
                    that measurements were not taken more frequently. Use the &apos;Exact&apos; step mode to set an
                    exact interval between data points. <code>$__interval</code> and <code>$__rate_interval</code> are
                    supported.
                  </>
                }
              >
                Step
              </InlineFormLabel>
              <Select
                menuShouldPortal
                className={'select-container'}
                width={16}
                isSearchable={false}
                options={STEP_MODES}
                onChange={this.onStepChange}
                value={stepMode}
              />
              <input
                type="text"
                className="gf-form-input width-4"
                placeholder="15s"
                onChange={this.onIntervalChange}
                onBlur={this.onRunQuery}
                value={interval}
              />
            </div>
            <div className="gf-form">
              <div className="gf-form-label">Resolution</div>
              <Select
                menuShouldPortal
                isSearchable={false}
                options={INTERVAL_FACTOR_OPTIONS}
                onChange={this.onIntervalFactorChange}
                value={intervalFactorOption}
              />
            </div>
            <div className="gf-form">
              <div className="gf-form-label width-7">Format</div>
              <Select
                menuShouldPortal
                className={'select-container'}
                width={16}
                isSearchable={false}
                options={FORMAT_OPTIONS}
                onChange={this.onFormatChange}
                value={formatOption}
              />
              <Switch label="Instant" checked={instant} onChange={this.onInstantChange} />

              <InlineFormLabel width={10} tooltip="Link to Graph in Prometheus">
                <PromLink
                  datasource={datasource}
                  query={this.query} // Use modified query
                  panelData={data}
                />
              </InlineFormLabel>
            </div>
            <PromExemplarField
              refId={query.refId}
              isEnabled={exemplar}
              onChange={this.onExemplarChange}
              datasource={datasource}
            />
          </div>
        }
      />
    );
  }
}

export const testIds = {
  editor: 'prom-editor',
};
