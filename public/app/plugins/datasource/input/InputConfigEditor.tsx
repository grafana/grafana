// Libraries
import React, { PureComponent } from 'react';

// Types
import { InputDatasourceOptions } from './types';

import { DataSourcePluginOptionsEditorProps, SeriesData, TableInputCSV, toCSV } from '@grafana/ui';

interface Props extends DataSourcePluginOptionsEditorProps<InputDatasourceOptions> {}

interface State {
  text: string;
}

export class InputConfigEditor extends PureComponent<Props, State> {
  state = {
    text: '',
  };

  onComponentDidMount() {
    const { options } = this.props;
    const text = options.data ? toCSV(options.data) : '';
    this.setState({ text });
  }

  onSeriesParsed = (data: SeriesData[], text: string) => {
    const { options, onOptionsChange } = this.props;
    this.setState({ text });
    if (!data) {
      data = [
        {
          fields: [],
          rows: [],
        },
      ];
    }
    onOptionsChange({ ...options, data });
  };

  render() {
    const { text } = this.state;
    return (
      <div>
        <div className="gf-form-group">
          <h4>Shared Data:</h4>
          <span>Enter CSV</span>
          <TableInputCSV text={text} onSeriesParsed={this.onSeriesParsed} width={'100%'} height={200} />
        </div>

        <div className="grafana-info-box">
          This data is stored in the datasource json and is returned to every user in the initial request for any
          datasource. This is an appropriate place to enter a few values. Large datasets will perform better in other
          datasources.
          <br />
          <br />
          <b>NOTE:</b> Changes to this data will only be reflected after a browser refresh.
        </div>
      </div>
    );
  }
}
