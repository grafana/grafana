import React, { PureComponent } from 'react';
import List from './TimeRangeList';
import NoTimeRanges from './NoTimeRanges';
import TimeRangeEditor from './TimeRangeEditor';
import { StoreState } from 'app/types';

import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { DashboardModel } from '../dashboard_model';

export interface Props {
  dashboard: DashboardModel;
}

const ranges = [
  {
    name: 'time range 1',
    from: '08:00',
    to: '16:00',
    newDay: false,
  },
  {
    name: 'time range 2',
    from: '16:00',
    to: '00:00',
    newDay: true,
  },
  {
    name: 'time range 3',
    from: '00:00',
    to: '08:00',
    newDay: false,
  },
];

let i;

export class Teste extends PureComponent<Props, { mode: string }> {
  constructor(props) {
    super(props);

    this.state = {
      mode: 'list',
    };
    this.setupNew = this.setupNew.bind(this);
    this.add = this.add.bind(this);
    this.edit = this.edit.bind(this);
    this.saveRange = this.saveRange.bind(this);
    this.backToList = this.backToList.bind(this);
    console.log('here', this.props);
  }
  add(range) {
    this.setState({ mode: 'list' });
    console.log('Add clicked', range);
  }
  delete(index) {
    i = index;
    console.log(index, 'Delete clicked');
  }
  edit(index) {
    i = index;
    this.setState({ mode: 'edit' });
    console.log(index, 'Edit clicked');
  }
  up(index) {
    i = index;
    console.log(index, 'Up clicked');
  }
  down(index) {
    i = index;
    console.log(index, 'Down clicked');
  }
  setupNew() {
    this.setState({ mode: 'new' });
    console.log('Setup new clicked');
  }
  saveRange(range) {
    this.setState({ mode: 'list' });
    console.log('Save range clicked', range);
  }
  backToList() {
    this.setState({ mode: 'list' });
    console.log('Back to list clicked');
  }
  render() {
    if (ranges.length === 0 && this.state.mode !== 'new') {
      this.setState({ mode: 'empty' });
    }
    return (
      <div>
        <h3 className="dashboard-settings__header">
          <a onClick={this.backToList}>Custom Time Ranges</a>
          {this.state.mode === 'new' ? <span> &gt; New</span> : null}
          {this.state.mode === 'edit' ? <span> &gt; Edit</span> : null}
        </h3>
        {this.state.mode === 'empty' ? <NoTimeRanges add={this.setupNew} /> : null}
        {this.state.mode === 'list' ? (
          <List
            ranges={ranges}
            add={this.setupNew}
            up={this.up}
            down={this.down}
            edit={this.edit}
            delete={this.delete}
          />
        ) : null}
        {this.state.mode === 'new' || this.state.mode === 'edit' ? (
          <TimeRangeEditor range={ranges[i]} add={this.add} update={this.saveRange} mode={this.state.mode} />
        ) : null}
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  dashboard: state.dashboard,
});

export default hot(module)(connect(mapStateToProps)(Teste));
