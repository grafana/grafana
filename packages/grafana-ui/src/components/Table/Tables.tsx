// Libraries
import _ from 'lodash';
import React, { Component } from 'react';
import Table, { BaseTableProps } from './Table';
import { DataFrame } from '@grafana/data';
import { AutoSizer } from 'react-virtualized';
import { Tooltip } from '../Tooltip/Tooltip';

interface Props extends BaseTableProps {
  data: DataFrame[];
}

interface State {
  selected: number;
}

export class Tables extends Component<Props, State> {
  static defaultProps = {
    minColumnWidth: 75,
    showHeader: true,
    fixedHeader: true,
    fixedColumns: 0,
    rotate: false,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      selected: 0,
    };
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { data } = this.props;
    const { selected } = this.state;
    if (data.length > 0) {
      if (selected >= data.length) {
        this.setState({ selected: data.length - 1 });
      }
    } else if (selected !== 0) {
      this.setState({ selected: 0 });
    }
  }

  onSelectionChange = (index: number) => {
    this.setState({ selected: index });
  };

  renderMetaInfo = (data: DataFrame) => {
    const rows: Array<{ key: string; value: any }> = [];
    if (data.refId) {
      rows.push({ key: 'RefID', value: data.refId });
    }
    if (data.labels) {
      for (const key in data.labels) {
        rows.push({ key, value: data.labels[key] });
      }
    }
    if (data.meta) {
      // TODO...
    }

    if (!rows.length) {
      return null;
    }

    const info = (
      <table>
        {rows.map((info, index) => {
          return (
            <tr key={index}>
              <td>{info.key}:</td>
              <td>{info.value}</td>
            </tr>
          );
        })}
      </table>
    );
    return (
      <Tooltip content={info} theme="info" placement="top">
        <i className="fa fa-info-circle" />
      </Tooltip>
    );
  };

  render() {
    const { data, width, height, ...rest } = this.props;
    let { selected } = this.state;
    let series = data[selected];

    if (!series && selected >= data.length) {
      selected = 0;
      series = data[selected];
    }

    return (
      <div className="gf-tables" style={{ width, height }}>
        <div className="gf-tables-table">
          <AutoSizer disableWidth>
            {({ height }) => <Table {...rest} data={series} height={height - 50} width={width} />}
          </AutoSizer>
        </div>
        <div className="gf-tables-toolbar">
          <ul>
            {data.map((data, index) => {
              let name = data.name;
              if (!name) {
                name = `Data: ${index}`;
              }
              return (
                <li
                  key={index}
                  className={index === selected ? 'selected' : ''}
                  onClick={() => this.onSelectionChange(index)}
                >
                  {name} {this.renderMetaInfo(data)}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
}

export default Tables;
