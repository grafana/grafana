import React from 'react';

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
  up: any;
  down: any;
  edit: any;
  delete: any;
  add: any;
}

export default class List extends React.Component<Props> {
  constructor(props) {
    super(props);
    this.state = { show: false };
  }

  clickUp(index) {
    this.props.up(index);
  }
  clickDown(index) {
    this.props.down(index);
  }
  clickEdit(index) {
    this.props.edit(index);
  }
  clickDelete(index) {
    this.props.delete(index);
  }
  setupNew = () => {
    this.props.add();
  };

  render() {
    const NewDay = props => {
      return (
        <span style={green} className="pointer">
          Starts a new day
        </span>
      );
    };

    const rowLen = this.props.ranges.length;
    const tableRows = this.props.ranges.map((range, index) => {
      return (
        <tr>
          <td className="pointer" onClick={() => this.clickEdit(index)}>
            <i className="fa fa-clock-o" />
            <span>&nbsp;&nbsp;shift</span>
          </td>
          <td onClick={() => this.clickEdit(index)}>
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
            {range.newDay ? <NewDay /> : null}
          </td>
          <td style={width1}>
            {index === 0 ? null : <i className="pointer fa fa-arrow-up" onClick={() => this.clickUp(index)} />}
          </td>
          <td style={width1}>
            {index === rowLen - 1 ? null : (
              <i className="pointer fa fa-arrow-down" onClick={() => this.clickDown(index)} />
            )}
          </td>
          <td style={width1}>
            <a className="btn btn-danger btn-mini">
              <i className="fa fa-remove" onClick={() => this.clickDelete(index)} />
            </a>
          </td>
        </tr>
      );
    });

    return (
      <div>
        <div className="page-action-bar">
          <div className="page-action-bar__spacer" />
          <a type="button" className="btn btn-success" onClick={this.setupNew}>
            <i className="fa fa-plus" /> New
          </a>
        </div>
        <table className="filter-table filter-table--hover">
          <thead>
            <tr>
              <th>Name</th>
              <th>Info</th>
            </tr>
          </thead>
          <tbody>{tableRows}</tbody>
        </table>
      </div>
    );
  }
}
