// Libraries
import React, { PureComponent } from 'react';

// Types
import { DataSourcePluginOptionsEditorProps, DataFrame, MutableDataFrame } from '@grafana/data';
import { TableInputCSV } from '@grafana/ui';

import { InputOptions } from './types';
import { dataFrameToCSV } from './utils';

interface Props extends DataSourcePluginOptionsEditorProps<InputOptions> {}

interface State {
  text: string;
}

export class InputConfigEditor extends PureComponent<Props, State> {
  state = {
    text: '',
  };

  componentDidMount() {
    const { options } = this.props;
    if (options.jsonData.data) {
      const text = dataFrameToCSV(options.jsonData.data);
      this.setState({ text });
    }
  }

  onSeriesParsed = (data: DataFrame[], text: string) => {
    const { options, onOptionsChange } = this.props;
    if (!data) {
      data = [new MutableDataFrame()];
    }
    // data is a property on 'jsonData'
    const jsonData = {
      ...options.jsonData,
      data,
    };

    onOptionsChange({
      ...options,
      jsonData,
    });
    this.setState({ text });
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
