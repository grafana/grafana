import React, { PureComponent } from 'react';

const width1 = {
  width: '1%',
};

const lightBlue = {
  color: '#32d1df',
};

const green = {
  color: '#269242',
};

export interface Props {
  ranges: any;
  move: any;
  edit: any;
  delete: any;
}

export default class Table extends PureComponent<Props> {
  move(index, dir) {
    this.props.move(index, dir);
  }
  edit(index) {
    this.props.edit(index);
  }
  delete(index) {
    this.props.delete(index);
  }

  render() {
    const NewDay = props => {
      return (
        <span style={green} className="pointer">
          Starts a new day
        </span>
      );
    };

    const rowLen = this.props.ranges.length;
    const TableRows = props =>
      this.props.ranges.map((range, index) => {
        return (
          <tr key={index}>
            <td className="pointer" onClick={() => this.edit(index)}>
              <i className="fa fa-clock-o" />
              <span>&nbsp;&nbsp;shift</span>
            </td>
            <td onClick={() => this.edit(index)}>
              <span className="pointer">
                <strong style={lightBlue}>Name: </strong>
                {range.name}
                <span>&nbsp;&nbsp;</span>
              </span>
              <span className="pointer">
                <strong style={lightBlue}>From: </strong>
                {range.from}
                <span>&nbsp;&nbsp;</span>
              </span>
              <span className="pointer">
                <strong style={lightBlue}>To: </strong>
                {range.to}
                <span>&nbsp;&nbsp;</span>
              </span>
              {range.newDay && <NewDay />}
            </td>
            <td style={width1}>
              {index === 0 ? null : <i className="pointer fa fa-arrow-up" onClick={() => this.move(index, -1)} />}
            </td>
            <td style={width1}>
              {index === rowLen - 1 ? null : (
                <i className="pointer fa fa-arrow-down" onClick={() => this.move(index, 1)} />
              )}
            </td>
            <td style={width1}>
              <a className="btn btn-danger btn-mini">
                <i className="fa fa-remove" onClick={() => this.delete(index)} />
              </a>
            </td>
          </tr>
        );
      });

    return (
      <table className="filter-table filter-table--hover">
        <thead>
          <tr>
            <th>Name</th>
            <th>Info</th>
          </tr>
        </thead>
        <tbody>
          <TableRows />
        </tbody>
      </table>
    );
  }
}
