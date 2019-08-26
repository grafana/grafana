// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Types
import { QueryEditorProps, Switch, FormField } from '@grafana/ui';
import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';
// ??? WHY DOES This fail?
// import { LokiQueryField } from './LokiQueryField';

type Props = QueryEditorProps<LokiDatasource, LokiQuery>;

export class LokiQueryEditor extends PureComponent<Props> {
  onQueryChange = (value: string, override?: boolean) => {
    console.log('CHANGE', value, override);
  };

  onExprChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      expr: event.target.value,
    });
    this.props.onRunQuery();
  };

  onToggleLive = () => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      live: !query.live,
    });
  };

  render() {
    const { query, datasource, onRunQuery } = this.props;
    const expr = query.expr || ''; // make sure it is defined, even if empty

    if (false) {
      console.log('XX', datasource, onRunQuery);
    }

    return (
      <div>
        {/* ??????? <LokiQueryField
          datasource={datasource}
          query={query}
          onQueryChange={this.onQueryChange}
          onExecuteQuery={onRunQuery}
          history={[]}
        /> */}
        <div className="gf-form-inline">
          <FormField label="expr" labelWidth={6} onChange={this.onExprChange} value={expr} />
          <div className="gf-form">
            <Switch label="Live" checked={!!query.live} onChange={this.onToggleLive} />
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
