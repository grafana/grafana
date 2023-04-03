import React, { PureComponent } from 'react';

import { InlineFormLabel, TextArea } from '@grafana/ui';

import InfluxDatasource from '../datasource';

import { FluxQueryEditor } from './FluxQueryEditor';

interface Props {
  query: string; // before flux, it was always a string
  onChange: (query?: string) => void;
  datasource: InfluxDatasource;
}

export default class VariableQueryEditor extends PureComponent<Props> {
  onRefresh = () => {
    // noop
  };

  render() {
    let { query, datasource, onChange } = this.props;
    if (datasource.isFlux) {
      return (
        <FluxQueryEditor
          datasource={datasource}
          query={{
            refId: 'A',
            expr: query,
          }}
          onRunQuery={this.onRefresh}
          onChange={(v) => onChange(v.expr)}
        />
      );
    }

    return (
      <div className="gf-form-inline">
        <InlineFormLabel width={10}>Query</InlineFormLabel>
        <div className="gf-form-inline gf-form--grow">
          <TextArea
            defaultValue={query || ''}
            placeholder="metric name or tags query"
            rows={1}
            className="gf-form-input"
            onBlur={(e) => onChange(e.currentTarget.value)}
          />
        </div>
      </div>
    );
  }
}
