// Libraries
import React, { PureComponent } from 'react';

// Types
import { QueryEditorProps, Switch, FormField } from '@grafana/ui';
import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';
// import { LokiQueryField } from './LokiQueryField';

type Props = QueryEditorProps<LokiDatasource, LokiQuery>;

interface State {
  query: LokiQuery;
}

export class LokiQueryEditor extends PureComponent<Props, State> {
  state: State = {
    query: this.props.query,
  };

  onRunQuery = () => {
    const { query } = this.state;

    this.props.onChange(query);
    this.props.onRunQuery();
  };

  onFieldChange = (query: LokiQuery) => {
    this.setState({
      query: {
        ...this.state.query,
        expr: query.expr,
      },
    });
  };

  onExprChange = (expr: string) => {
    this.setState({
      query: {
        ...this.state.query,
        expr,
      },
    });
  };

  onToggleLive = () => {
    const { query } = this.state;
    this.setState({
      query: {
        ...query,
        live: !query.live,
      },
    });
  };

  render() {
    const { query } = this.state;
    // const { datasource } = this.props;

    return (
      <div>
        {/*   // WHY IS THIS FAILING       
        <LokiQueryField
          datasource={datasource}
          query={query}
          onQueryChange={this.onFieldChange}
          onExecuteQuery={this.onRunQuery}
          history={[]}
        /> */}
        <div className="gf-form-inline">
          <FormField label="expr" labelWidth={6} onChange={this.onExprChange} value={query.expr} />
          <div className="gf-form">
            <Switch label="Live" checked={query.live} onChange={this.onToggleLive} />
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
      </div>
    );
  }
}

export default LokiQueryEditor;
