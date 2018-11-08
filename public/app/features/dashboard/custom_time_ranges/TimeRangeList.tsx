import React, { PureComponent } from 'react';
import Table from './TimeRangeTable';

export interface Props {
  ranges: any;
  move: any;
  edit: any;
  delete: any;
  add: any;
}

export default class List extends PureComponent<Props> {
  move = (index, dir) => {
    this.props.move(index, dir);
  };
  edit = index => {
    this.props.edit(index);
  };
  delete = index => {
    this.props.delete(index);
  };
  setupNew = () => {
    this.props.add();
  };

  render() {
    return (
      <div>
        <div className="page-action-bar">
          <div className="page-action-bar__spacer" />
          <a type="button" className="btn btn-success" onClick={this.setupNew}>
            <i className="fa fa-plus" /> New
          </a>
        </div>
        <Table ranges={this.props.ranges} move={this.move} edit={this.edit} delete={this.delete} />
      </div>
    );
  }
}
