import { css, cx } from '@emotion/css';
import { PureComponent } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data/src';
import { getTemplateSrv } from '@grafana/runtime/src';
import {
  CodeEditor,
  CodeEditorSuggestionItem,
  CodeEditorSuggestionItemKind,
  InlineFormLabel,
  LinkButton,
  MonacoEditor,
  Segment,
  Themeable2,
  withTheme2,
} from '@grafana/ui/src';

import InfluxDatasource from '../../../../datasource';
import { InfluxQuery } from '../../../../types';

interface Props extends Themeable2 {
  onChange: (query: InfluxQuery) => void;
  query: InfluxQuery;
  // `datasource` is not used internally, but this component is used at some places
  // directly, where the `datasource` prop has to exist. later, when the whole
  // query-editor gets converted to react we can stop using this component directly
  // and then we can probably remove the datasource attribute.
  datasource: InfluxDatasource;
}

const samples: Array<SelectableValue<string>> = [
  { label: 'Show buckets', description: 'List the available buckets (table)', value: 'buckets()' },
  {
    label: 'Simple query',
    description: 'filter by measurement and field',
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

class UnthemedFluxQueryEditor extends PureComponent<Props> {
  onFluxQueryChange = (query: string) => {
    this.props.onChange({ ...this.props.query, query });
  };

  onSampleChange = (val: SelectableValue<string>) => {
    this.props.onChange({
      ...this.props.query,
      query: val.value!,
    });

    // Angular HACK: Since the target does not actually change!
    this.forceUpdate();
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
    templateSrv.getVariables().forEach((variable) => {
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
  // is not set properly.  This forces the layout shortly after mount so that it
  // displays OK.  Note: this is not an issue when used directly in react
  editorDidMountCallbackHack = (editor: MonacoEditor) => {
    setTimeout(() => editor.layout(), 100);
  };

  render() {
    const { query, theme } = this.props;
    const styles = getStyles(theme);

    const helpTooltip = (
      <div>
        Type: <i>ctrl+space</i> to show template variable suggestions <br />
        Many queries can be copied from Chronograf
      </div>
    );

    return (
      <>
        <CodeEditor
          height={'100%'}
          containerStyles={styles.editorContainerStyles}
          language="sql"
          value={query.query || ''}
          onBlur={this.onFluxQueryChange}
          onSave={this.onFluxQueryChange}
          showMiniMap={false}
          showLineNumbers={true}
          getSuggestions={this.getSuggestions}
          onEditorDidMount={this.editorDidMountCallbackHack}
        />
        <div className={cx('gf-form-inline', styles.editorActions)}>
          <LinkButton
            icon="external-link-alt"
            variant="secondary"
            target="blank"
            href="https://docs.influxdata.com/influxdb/latest/query-data/get-started/"
          >
            Flux language syntax
          </LinkButton>
          <Segment
            options={samples}
            value="Sample query"
            onChange={this.onSampleChange}
            className={css({
              marginTop: theme.spacing(-0.5),
              marginLeft: theme.spacing(0.5),
            })}
          />
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

const getStyles = (theme: GrafanaTheme2) => ({
  editorContainerStyles: css({
    height: '200px',
    maxWidth: '100%',
    resize: 'vertical',
    overflow: 'auto',
    backgroundColor: theme.isDark ? theme.colors.background.canvas : theme.colors.background.primary,
    paddingBottom: theme.spacing(1),
  }),
  editorActions: css({
    marginTop: '6px',
  }),
});

export const FluxQueryEditor = withTheme2(UnthemedFluxQueryEditor);
