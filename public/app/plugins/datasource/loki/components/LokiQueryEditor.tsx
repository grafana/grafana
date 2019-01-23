// Libraries
import React, { PureComponent } from 'react';

// Types
import { QueryEditorProps } from '@grafana/ui/src/types';
import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';
import { LokiQueryField } from './LokiQueryField';

type Props = QueryEditorProps<LokiDatasource, LokiQuery>;

interface State {
  query: LokiQuery;
}

export class LokiQueryEditor extends PureComponent<Props> {

  state: State = {
    query: this.props.query
  };

  onRunQuery = () => {
    const { query  } = this.state;

    this.props.onChange(query);
    this.props.onRunQuery();
  };

  onFieldChange = (query: LokiQuery, override?) => {
    this.setState({
      query:  query
    });
  };

  render() {
    const { query  } = this.state;
    const { datasource } = this.props;

    return (
      <div>
        <LokiQueryField datasource={datasource} initialQuery={query} onQueryChange={this.onFieldChange} onPressEnter={this.onRunQuery} />
      </div>
    );
  }
}

export default LokiQueryEditor;
