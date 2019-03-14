// Libraries
import _ from 'lodash';
import React, { Component } from 'react';
import Table, { BaseTableProps } from './Table';
import { TableData } from '../../types/data';
import { AutoSizer } from 'react-virtualized';

interface Props extends BaseTableProps {
  data: TableData[];
}

interface State {
  selected: number;
}

export class Tables extends Component<Props, State> {
  static defaultProps = {
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

  render() {
    const { data, width, height } = this.props;
    let { selected } = this.state;
    let table = data[selected];

    if (!table && selected >= data.length) {
      selected = 0;
      table = data[selected];
    }

    // TODO, help please :)
    // How do I get the table on top and a toolbar on the bottom?
    //  ... css wizardry no doubt!

    return (
      <div className="gf-tables" style={{ width, height }}>
        <div className="gf-tables-table">
          <AutoSizer disableWidth>
            {({ height }) => <Table {...this.props} data={table} height={height - 50} />}
          </AutoSizer>
        </div>
        <div className="gf-tables-toolbar">
          <ul>
            {data.map((table, index) => {
              return (
                <li
                  key={index}
                  className={index === selected ? 'selected' : ''}
                  onClick={() => this.onSelectionChange(index)}
                >
                  TABLE: {index}
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
