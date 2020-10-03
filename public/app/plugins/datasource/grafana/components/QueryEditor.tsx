import defaults from 'lodash/defaults';

import React, { PureComponent } from 'react';
import { InlineField, Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { GrafanaDatasource } from '../datasource';
import { defaultQuery, GrafanaQuery, GrafanaQueryType } from '../types';

type Props = QueryEditorProps<GrafanaDatasource, GrafanaQuery>;

const labelWidth = 12;

export class QueryEditor extends PureComponent<Props> {
  queryTypes: Array<SelectableValue<GrafanaQueryType>> = [
    {
      label: 'Random Walk',
      value: GrafanaQueryType.RandomWalk,
      description: 'Random signal within the selected time rage',
    },
    {
      label: 'Live Measurements',
      value: GrafanaQueryType.LiveMeasurements,
      description: 'Stream real-time measurements from grafana',
    },
  ];

  onQueryTypeChange = (sel: SelectableValue<GrafanaQueryType>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, queryType: sel.value! });
    onRunQuery();
  };

  onChannelChange = (sel: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, channel: sel.value! });
    onRunQuery();
  };

  onMeasurmentNameChanged = (sel: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({
      ...query,
      measurements: {
        ...query.measurements,
        name: sel.value!,
      },
    });
    onRunQuery();
  };

  renderMeasurementsQuery() {
    let { channel, measurements } = this.props.query;
    const channels: Array<SelectableValue<string>> = [];
    if (!measurements) {
      measurements = {};
    }
    const names: Array<SelectableValue<string>> = [
      { value: '', label: 'All measurements', description: 'show every measurment streamed to this channel' },
    ];
    if (measurements.name) {
      names.push({
        label: measurements.name,
        value: measurements.name,
        description: `Frames with name ${measurements.name}`,
      });
    }

    return (
      <>
        <div className="gf-form">
          <InlineField label="Channel" grow={true} labelWidth={labelWidth}>
            <Select
              options={channels}
              value={channels.find(v => v.value === channel) || channel || ''}
              onChange={this.onChannelChange}
              allowCustomValue={true}
              backspaceRemovesValue={true}
              placeholder="Select measurments channel"
              isClearable={true}
              noOptionsMessage="Enter channel name"
              formatCreateLabel={(input: string) => `Conncet to: ${input}`}
            />
          </InlineField>
        </div>
        {channel && (
          <div className="gf-form">
            <InlineField label="Measurement" grow={true} labelWidth={labelWidth}>
              <Select
                options={names}
                value={names.find(v => v.value === channel) || names[0]}
                onChange={this.onMeasurmentNameChanged}
                allowCustomValue={true}
                backspaceRemovesValue={true}
                placeholder="Filter by name"
                isClearable={true}
                noOptionsMessage="Filter by name"
                formatCreateLabel={(input: string) => `Show: ${input}`}
              />
            </InlineField>
          </div>
        )}
      </>
    );
  }

  render() {
    const query = defaults(this.props.query, defaultQuery);
    return (
      <>
        <div className="gf-form">
          <InlineField label="Query type" grow={true} labelWidth={labelWidth}>
            <Select
              options={this.queryTypes}
              value={this.queryTypes.find(v => v.value === query.queryType) || this.queryTypes[0]}
              onChange={this.onQueryTypeChange}
            />
          </InlineField>
        </div>
        {query.queryType === GrafanaQueryType.LiveMeasurements && this.renderMeasurementsQuery()}
      </>
    );
  }
}
