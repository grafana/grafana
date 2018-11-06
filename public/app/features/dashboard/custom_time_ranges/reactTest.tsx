import React from 'react';
import List from './TimeRangeList';
import NoTimeRanges from './NoTimeRanges';
import TimeRangeEditor from './TimeRangeEditor';

let show = true;

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

export class Teste extends React.Component {
  constructor(props) {
    super(props);
    this.state = { show: false };
  }
  toggle() {
    show = !show;
    console.log('clicked', show);
  }
  removeButton() {
    this.forceUpdate();
  }
  add() {
    console.log('Add clicked');
  }
  delete(index) {
    console.log(index, 'Delete clicked');
  }
  edit(index) {
    console.log(index, 'Edit clicked');
  }
  up(index) {
    console.log(index, 'Up clicked');
  }
  down(index) {
    console.log(index, 'Down clicked');
  }
  setupNew() {
    console.log('Setup new clicked');
  }
  saveRange() {
    console.log('Save range clicked');
  }
  backToList() {
    console.log('Back to list clicked');
  }

  render() {
    return (
      <div>
        <h3 className="dashboard-settings__header">
          <a onClick={this.backToList}>Custom Time Ranges</a>
          <span>&gt; New</span>
          <span>&gt; Edit</span>
        </h3>
        <NoTimeRanges add={this.setupNew} />
        <TimeRangeEditor ranges={ranges} add={this.add} update={this.saveRange} />
        <List ranges={ranges} add={this.setupNew} up={this.up} down={this.down} edit={this.edit} delete={this.delete} />
      </div>
    );
  }
}
