// Libraries
import React, { PureComponent } from 'react';

// Types
import { QueryEditorProps } from '@grafana/data';
import { InlineFormLabel } from '@grafana/ui';
import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';
import { LokiQueryField } from './LokiQueryField';

type Props = QueryEditorProps<LokiDatasource, LokiQuery>;

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
        </div>
      </div>
    );
  }
}

export default LokiQueryEditor;
