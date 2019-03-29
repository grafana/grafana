// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Types
import { QueryEditorProps } from '@grafana/ui/src/types';
import { StreamingDatasource } from './datasource';
import { StreamingQuery, StreamingMethod } from './types';
import { Select, SelectOptionItem, FormLabel, FormField } from '@grafana/ui';
import { FetchQuery } from './method/fetch/types';

type Props = QueryEditorProps<StreamingDatasource, StreamingQuery>;

const types = [
  { value: StreamingMethod.fetch, label: 'Fetch', description: 'Fetch via HTTP' },
  { value: StreamingMethod.random, label: 'Random', description: 'Random stream (javascript)' },
];
const labelWidth = 8;

export class StreamingQueryEditor extends PureComponent<Props> {
  // TODO!!! nout used
  getCollapsedText() {
    return 'Streming!';
  }

  onMethodChanged = (item: SelectOptionItem) => {
    const { query, onChange, onRunQuery } = this.props;
    console.log('CHANGE Query', item);
    onChange({
      ...query,
      method: item.value,
    });
    onRunQuery();
  };

  onSpeedChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(event.target.value, 10);
    if (!isNaN(v)) {
      const { query, onChange, onRunQuery } = this.props;
      onChange({
        ...query,
        speed: v,
      } as StreamingQuery);
      onRunQuery();
    }
  };

  onSpreadChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(event.target.value, 10);
    if (!isNaN(v)) {
      const { query, onChange, onRunQuery } = this.props;
      onChange({
        ...query,
        spread: v,
      } as StreamingQuery);
      onRunQuery();
    }
  };

  onUrlChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value;
    const { query, onChange, onRunQuery } = this.props;
    onChange({
      ...query,
      url,
    } as StreamingQuery);
    onRunQuery();
  };

  renderRandomOptions() {
    const query = this.props.query as any;
    return (
      <>
        <div className="gf-form">
          <FormField
            label="Speed"
            labelWidth={labelWidth}
            onChange={this.onSpeedChanged}
            value={query.speed}
            type="number"
            min="10"
            max="100000"
            step="100"
          />
        </div>
        <div className="gf-form">
          <FormField
            label="Spread"
            labelWidth={labelWidth}
            onChange={this.onSpreadChanged}
            value={query.spread}
            type="number"
            min="0.02"
            max="10"
            step="0.01"
          />
        </div>
      </>
    );
  }

  renderFetchOptions() {
    const query = this.props.query as FetchQuery;
    return (
      <>
        <div className="gf-form">
          <FormField
            label="URL"
            labelWidth={labelWidth}
            onChange={this.onUrlChanged}
            value={query.url}
            placeholder="Enter URL"
          />
        </div>
        {this.renderRandomOptions()}
      </>
    );
  }

  render() {
    const { query } = this.props;
    const current = types.find(v => v.value === query.method);
    return (
      <div>
        <div className="gf-form">
          <FormLabel width={labelWidth}>Method</FormLabel>
          <Select value={current} options={types} onChange={this.onMethodChanged} />
        </div>
        {query.method === StreamingMethod.random && this.renderRandomOptions()}
        {query.method === StreamingMethod.fetch && this.renderFetchOptions()}
      </div>
    );
  }
}

export default StreamingQueryEditor;
