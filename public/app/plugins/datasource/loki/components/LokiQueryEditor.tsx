// Libraries
import React, { PureComponent } from 'react';

// Types
import { QueryEditorProps } from '@grafana/data';
import { InlineFormLabel } from '@grafana/ui';
import { LokiDatasource } from '../datasource';
import { LokiQuery, LokiOptions } from '../types';
import { LokiQueryField } from './LokiQueryField';
import { LokiExploreExtraField } from './LokiExploreExtraField';

type Props = QueryEditorProps<LokiDatasource, LokiQuery, LokiOptions>;

interface State {
  legendFormat: string;
}

export class LokiQueryEditor extends PureComponent<Props, State> {
  // Query target to be modified and used for queries
  query: LokiQuery;

  constructor(props: Props) {
    super(props);
    // Use default query to prevent undefined input values
    const defaultQuery: Partial<LokiQuery> = { expr: '', legendFormat: '' };
    const query = Object.assign({}, defaultQuery, props.query);
    this.query = query;
    // Query target properties that are fully controlled inputs
    this.state = {
      // Fully controlled text inputs
      legendFormat: query.legendFormat ?? '',
    };
  }

  onFieldChange = (query: LokiQuery, override?: any) => {
    this.query.expr = query.expr;
  };

  onLegendChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const legendFormat = e.currentTarget.value;
    this.query.legendFormat = legendFormat;
    this.setState({ legendFormat });
  };

  onRunQuery = () => {
    const { query } = this;
    this.props.onChange(query);
    this.props.onRunQuery();
  };

  onChangeQueryLimit = (value: string) => {
    const { query, onChange } = this.props;
    const nextQuery = { ...query, maxLines: this.preprocessMaxLines(value) };
    onChange(nextQuery);
  };

  onQueryTypeChange = (value: string) => {
    const { query, onChange } = this.props;
    let nextQuery;
    if (value === 'instant') {
      nextQuery = { ...query, instant: true, range: false };
    } else {
      nextQuery = { ...query, instant: false, range: true };
    }
    onChange(nextQuery);
  };

  preprocessMaxLines = (value: string) => {
    if (value.length === 0) {
      // empty input - falls back to dataSource.maxLines limit
      return NaN;
    } else if (value.length > 0 && (isNaN(+value) || +value < 0)) {
      // input with at least 1 character and that is either incorrect (value in the input field is not a number) or negative
      // falls back to the limit of 0 lines
      return 0;
    } else {
      // default case - correct input
      return +value;
    }
  };

  onMaxLinesChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const { query } = this.props;
    if (query.maxLines !== this.preprocessMaxLines(e.currentTarget.value)) {
      this.onChangeQueryLimit(e.currentTarget.value);
    }
  };

  onReturnKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      this.props.onRunQuery();
    }
  };

  render() {
    const { datasource, query, data, range } = this.props;
    const { legendFormat } = this.state;

    return (
      <div>
        <LokiQueryField
          datasource={datasource}
          query={query}
          onChange={this.onFieldChange}
          onRunQuery={this.onRunQuery}
          history={[]}
          data={data}
          range={range}
        />

        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel
              width={7}
              tooltip="Controls the name of the time series, using name or pattern. For example
        {{hostname}} will be replaced with label value for the label hostname. The legend only applies to metric queries."
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
          <LokiExploreExtraField
            lineLimitValue={query?.maxLines?.toString() || ''}
            queryType={query.instant ? 'instant' : 'range'}
            onQueryTypeChange={this.onQueryTypeChange}
            onLineLimitChange={this.onMaxLinesChange}
            onKeyDownFunc={this.onReturnKeyDown}
            runOnBlur={true}
            onRunQuery={this.props.onRunQuery}
          />
        </div>
      </div>
    );
  }
}

export default LokiQueryEditor;
