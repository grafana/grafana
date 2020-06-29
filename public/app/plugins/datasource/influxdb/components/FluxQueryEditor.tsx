import React, { Component } from 'react';
import coreModule from 'app/core/core_module';
import { InfluxQuery } from '../types';
import { SelectableValue } from '@grafana/data';
import { InlineFormLabel, LinkButton, Segment, TextArea } from '@grafana/ui';

interface Props {
  target: InfluxQuery;
  change: (target: InfluxQuery) => void;
  refresh: () => void;
}

const samples: Array<SelectableValue<string>> = [
  { label: 'Show buckets', description: 'List the avaliable buckets (table)', value: 'buckets()' },
  {
    label: 'Simple query',
    description: 'filter by measurment and field',
    value: `from(bucket: "db/rp")
  |> range(start: v.timeRangeStart, stop:v.timeRangeStop)
  |> filter(fn: (r) =>
    r._measurement == "example-measurement" and
    r._field == "example-field"
  )`,
  },
  {
    label: 'Grouped Query',
    description: 'Group by (min/max/sum/median)',
    value: `// v.windowPeriod is a variable referring to the current optimized window period (currently: $interval)
from(bucket: v.bucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "measurement1" or r["_measurement"] =~ /^.*?regex.*$/)
  |> filter(fn: (r) => r["_field"] == "field2" or r["_field"] =~ /^.*?regex.*$/)
  |> aggregateWindow(every: v.windowPeriod, fn: mean|median|max|count|derivative|sum)
  |> yield(name: "some-name")`,
  },
  {
    label: 'Filter by value',
    description: 'Results between a min/max',
    value: `// v.bucket, v.timeRangeStart, and v.timeRange stop are all variables supported by the flux plugin and influxdb
from(bucket: v.bucket)
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_value"] >= 10 and r["_value"] <= 20)`,
  },
  {
    label: 'Schema Exploration: (measurements)',
    description: 'Get a list of measurement using flux',
    value: `import "influxdata/influxdb/v1"
v1.measurements(bucket: v.bucket)`,
  },
  {
    label: 'Schema Exploration: (fields)',
    description: 'Return every possible key in a single table',
    value: `from(bucket: v.bucket)
  |> range(start: v.timeRangeStart, stop:timeRangeStop)
  |> keys()
  |> keep(columns: ["_value"])
  |> group()
  |> distinct()`,
  },
  {
    label: 'Schema Exploration: (tag keys)',
    description: 'Get a list of tag keys using flux',
    value: `import "influxdata/influxdb/v1"
v1.tagKeys(bucket: v.bucket)`,
  },
  {
    label: 'Schema Exploration: (tag values)',
    description: 'Get a list of tag values using flux',
    value: `import "influxdata/influxdb/v1"
v1.tagValues(
    bucket: v.bucket,
    tag: "host",
    predicate: (r) => true,
    start: -1d
)`,
  },
];

export class FluxQueryEditor extends Component<Props> {
  onFluxQueryChange = (e: any) => {
    const { target, change } = this.props;
    change({ ...target, query: e.currentTarget.value });
  };

  onFluxBlur = (e: any) => {
    this.props.refresh();
  };

  onSampleChange = (val: SelectableValue<string>) => {
    this.props.change({
      ...this.props.target,
      query: val.value!,
    });

    // Angular HACK: Since the target does not actually change!
    this.forceUpdate();
    this.props.refresh();
  };

  render() {
    const { target } = this.props;
    return (
      <>
        <div className="gf-form">
          <TextArea
            value={target.query || ''}
            onChange={this.onFluxQueryChange}
            onBlur={this.onFluxBlur}
            placeholder="Flux query"
            rows={10}
          />
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel width={5} tooltip="Queries can be copied from chronograph">
              Help
            </InlineFormLabel>
            <Segment options={samples} value="Sample Query" onChange={this.onSampleChange} />
            <LinkButton
              icon="external-link-alt"
              variant="secondary"
              target="blank"
              href="https://docs.influxdata.com/flux/latest/introduction/getting-started/"
            >
              Flux docs
            </LinkButton>
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow"></div>
          </div>
        </div>
      </>
    );
  }
}

coreModule.directive('fluxQueryEditor', [
  'reactDirective',
  (reactDirective: any) => {
    return reactDirective(FluxQueryEditor, ['target', 'change', 'refresh']);
  },
]);
