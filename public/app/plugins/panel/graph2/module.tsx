// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Types
import { PanelProps } from 'app/types';

interface Options {
  showBars: boolean;
}

interface Props extends PanelProps {
  options: Options;
}

export class Graph2 extends PureComponent<Props> {
  constructor(props) {
    super(props);
  }

  render() {
    const { timeSeries } = this.props;
    let index = 0;

    return (
      <table className="filter-table">
        <tbody>
          {timeSeries.map(series => {
            return (
              <tr key={index++}>
                <td>{series.target}</td>
                <td>{series.datapoints[0][0]}</td>
                <td>{series.datapoints[0][1]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}

export class TextOptions extends PureComponent<any> {
  render() {
    return <p>Text2 Options component</p>;
  }
}

export { Graph2 as PanelComponent, TextOptions as PanelOptions };
