// Libraries
import React, { PureComponent } from 'react';

// Types
import { InputDatasource } from './datasource';
import { InputQuery } from './types';

import { FormLabel, Select, QueryEditorProps, SelectOptionItem, SeriesData, TableInputCSV, toCSV } from '@grafana/ui';

type Props = QueryEditorProps<InputDatasource, InputQuery>;

const options = [
  { value: 'panel', label: 'Panel', description: 'Save data in the panel configuration.' },
  { value: 'shared', label: 'Shared', description: 'Save data in the shared datasource object.' },
];

interface State {
  text: string;
}

export class InputQueryEditor extends PureComponent<Props, State> {
  state = {
    text: '',
  };

  onComponentDidMount() {
    const { query } = this.props;
    const text = query.data ? toCSV(query.data) : '';
    this.setState({ text });
  }

  onSourceChange = (item: SelectOptionItem<string>) => {
    const { datasource, query, onChange, onRunQuery } = this.props;
    let data: SeriesData[] | undefined = undefined;
    if (item.value === 'panel') {
      if (query.data) {
        return;
      }
      data = [...datasource.data];
      if (!data) {
        data = [
          {
            fields: [],
            rows: [],
          },
        ];
      }
      this.setState({ text: toCSV(data) });
    }
    onChange({ ...query, data });
    onRunQuery();
  };

  onSeriesParsed = (data: SeriesData[], text: string) => {
    const { query, onChange, onRunQuery } = this.props;
    this.setState({ text });
    if (!data) {
      data = [
        {
          fields: [],
          rows: [],
        },
      ];
    }
    onChange({ ...query, data });
    onRunQuery();
  };

  render() {
    const { datasource, query } = this.props;
    const { id, name } = datasource;
    const { text } = this.state;

    const selected = query.data ? options[0] : options[1];
    return (
      <div>
        <div className="gf-form">
          <FormLabel width={4}>Data</FormLabel>
          <Select width={6} options={options} value={selected} onChange={this.onSourceChange} />

          <div className="btn btn-link">
            {query.data ? (
              datasource.getDescription(query.data)
            ) : (
              <a href={`datasources/edit/${id}/`}>
                {name}: {datasource.getDescription(datasource.data)} &nbsp;&nbsp;
                <i className="fa fa-pencil-square-o" />
              </a>
            )}
          </div>
        </div>
        {query.data && <TableInputCSV text={text} onSeriesParsed={this.onSeriesParsed} width={'100%'} height={200} />}
      </div>
    );
  }
}

export default InputQueryEditor;
