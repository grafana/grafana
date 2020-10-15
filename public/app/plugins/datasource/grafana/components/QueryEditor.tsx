import defaults from 'lodash/defaults';

import React, { PureComponent } from 'react';
import { InlineField, Select, FeatureInfoBox } from '@grafana/ui';
import { QueryEditorProps, SelectableValue, LiveChannelScope, FeatureState } from '@grafana/data';
import { getLiveMeasurements, LiveMeasurements } from '@grafana/runtime';
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
    {
      label: 'Streaming testdata',
      value: GrafanaQueryType.TestData,
      description: 'NOTE: this will be moved to the tesdata source, when it is reactified',
    },
  ];

  onQueryTypeChange = (sel: SelectableValue<GrafanaQueryType>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, queryType: sel.value! });
    onRunQuery();
  };

  onChannelChange = (sel: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, channel: sel?.value });
    onRunQuery();
  };

  onMeasurmentNameChanged = (sel: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({
      ...query,
      measurements: {
        ...query.measurements,
        name: sel?.value,
      },
    });
    onRunQuery();
  };

  renderMeasurementsQuery() {
    let { channel, measurements, queryType } = this.props.query;

    const namespace = queryType === GrafanaQueryType.LiveMeasurements ? 'measurements' : 'testdata';
    const channels: Array<SelectableValue<string>> =
      namespace === 'testdata'
        ? [
            {
              label: 'random-2s-stream',
              value: 'random-2s-stream',
              description: 'Random stream with points every 2s',
            },
            {
              label: 'random-flakey-stream',
              value: 'random-flakey-stream',
              description: 'Random stream with flakey data points',
            },
          ]
        : [];

    let currentChannel = channels.find(c => c.value === channel);
    if (channel && !currentChannel) {
      currentChannel = {
        value: channel,
        label: channel,
        description: `Connected to ${channel}`,
      };
      channels.push(currentChannel);
    }

    if (!measurements) {
      measurements = {};
    }
    const names: Array<SelectableValue<string>> = [
      { value: '', label: 'All measurements', description: 'show every measurment streamed to this channel' },
    ];

    let info: LiveMeasurements | undefined = undefined;
    if (channel) {
      info = getLiveMeasurements({
        scope: LiveChannelScope.Grafana,
        namespace,
        path: channel,
      });

      let foundName = false;
      if (info) {
        for (const name of info.getDistinctNames()) {
          names.push({
            value: name,
            label: name,
          });
          if (name === measurements.name) {
            foundName = true;
          }
        }
      } else {
        console.log('NO INFO for', channel);
      }

      if (measurements.name && !foundName) {
        names.push({
          label: measurements.name,
          value: measurements.name,
          description: `Frames with name ${measurements.name}`,
        });
      }
    }

    return (
      <>
        <div className="gf-form">
          <InlineField label="Channel" grow={true} labelWidth={labelWidth}>
            <Select
              options={channels}
              value={currentChannel || ''}
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
                value={names.find(v => v.value === measurements?.name) || names[0]}
                onChange={this.onMeasurmentNameChanged}
                allowCustomValue={true}
                backspaceRemovesValue={true}
                placeholder="Filter by name"
                isClearable={true}
                noOptionsMessage="Filter by name"
                formatCreateLabel={(input: string) => `Show: ${input}`}
                isSearchable={true}
              />
            </InlineField>
          </div>
        )}

        <FeatureInfoBox title="Grafana Live - Measurments" featureState={FeatureState.alpha}>
          <p>
            This supports real-time event streams in grafana core. This feature is under heavy development. Expect the
            intefaces and structures to change as this becomes more production ready.
          </p>
        </FeatureInfoBox>
      </>
    );
  }

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const ismeasure =
      query.queryType === GrafanaQueryType.LiveMeasurements || query.queryType === GrafanaQueryType.TestData;

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
        {ismeasure && this.renderMeasurementsQuery()}
      </>
    );
  }
}
