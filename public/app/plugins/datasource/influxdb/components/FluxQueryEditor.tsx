import React, { PureComponent } from 'react';
import coreModule from 'app/core/core_module';
import { InfluxQuery } from '../types';
import { SelectableValue, QueryEditorProps } from '@grafana/data';
import { cx, css } from 'emotion';
import {
  InlineFormLabel,
  LinkButton,
  Segment,
  CodeEditor,
  CodeEditorSuggestionItem,
  CodeEditorSuggestionItemKind,
} from '@grafana/ui';
import { getTemplateSrv } from '@grafana/runtime';
import InfluxDatasource from '../datasource';

// @ts-ignore -- complicated since the datasource is not really reactified yet!
type Props = QueryEditorProps<InfluxDatasource, InfluxQuery>;

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
  |> range(start: v.timeRangeStart, stop:v.timeRangeStop)
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

export class FluxQueryEditor extends PureComponent<Props> {
  onFluxQueryChange = (query: string) => {
    this.props.onChange({ ...this.props.query, query });
    this.props.onRunQuery();
  };

  onSampleChange = (val: SelectableValue<string>) => {
    this.props.onChange({
      ...this.props.query,
      query: val.value!,
    });

    // Angular HACK: Since the target does not actually change!
    this.forceUpdate();
    this.props.onRunQuery();
  };

  getSuggestions = (): CodeEditorSuggestionItem[] => {
    const sugs: CodeEditorSuggestionItem[] = [
      {
        label: 'v.timeRangeStart',
        kind: CodeEditorSuggestionItemKind.Property,
        detail: 'The start time',
      },
      {
        label: 'v.timeRangeStop',
        kind: CodeEditorSuggestionItemKind.Property,
        detail: 'The stop time',
      },
      {
        label: 'v.windowPeriod',
        kind: CodeEditorSuggestionItemKind.Property,
        detail: 'based on max data points',
      },
      {
        label: 'v.defaultBucket',
        kind: CodeEditorSuggestionItemKind.Property,
        detail: 'bucket configured in the datsource',
      },
      {
        label: 'v.organization',
        kind: CodeEditorSuggestionItemKind.Property,
        detail: 'org configured for the datsource',
      },
    ];

    const templateSrv = getTemplateSrv();
    templateSrv.getVariables().forEach(variable => {
      const label = '${' + variable.name + '}';
      let val = templateSrv.replace(label);
      if (val === label) {
        val = '';
      }
      sugs.push({
        label,
        kind: CodeEditorSuggestionItemKind.Text,
        detail: `(Template Variable) ${val}`,
      });
    });

    return sugs;
  };

  // For some reason in angular, when this component gets re-mounted, the width
  // is not set properly.  This forces the layout shorly after mount so that it
  // displays OK.  Note: this is not an issue when used directly in react
  editorDidMountCallbackHack = (editor: any) => {
    setTimeout(() => editor.layout(), 100);
  };

  render() {
    const { query } = this.props;

    const helpTooltip = (
      <div>
        Type: <i>ctrl+space</i> to show template variable suggestions <br />
        Many queries can be copied from chronograph
      </div>
    );

    return (
      <>
        <CodeEditor
          height={'200px'}
          language="sql"
          value={query.query || ''}
          onBlur={this.onFluxQueryChange}
          onSave={this.onFluxQueryChange}
          showMiniMap={false}
          showLineNumbers={true}
          getSuggestions={this.getSuggestions}
          onEditorDidMount={this.editorDidMountCallbackHack}
        />
        <div
          className={cx(
            'gf-form-inline',
            css`
              margin-top: 6px;
            `
          )}
        >
          <LinkButton
            icon="external-link-alt"
            variant="secondary"
            target="blank"
            href="https://docs.influxdata.com/flux/latest/introduction/getting-started/"
          >
            Flux language syntax
          </LinkButton>
          <Segment options={samples} value="Sample Query" onChange={this.onSampleChange} />
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow"></div>
          </div>
          <InlineFormLabel width={5} tooltip={helpTooltip}>
            Help
          </InlineFormLabel>
        </div>
      </>
    );
  }
}

coreModule.directive('fluxQueryEditor', [
  'reactDirective',
  (reactDirective: any) => {
    return reactDirective(FluxQueryEditor, ['query', 'onChange', 'onRunQuery']);
  },
]);
