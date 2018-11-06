import React, { PureComponent } from 'react';
import { DashboardModel } from '../dashboard_model';

export interface Props {}
export interface State {
  value: string;
  dashboard: DashboardModel;
}

export class CustomTimeRangeEditor extends PureComponent<Props, State> {
  constructor(props) {
    super(props);
    this.state = null;
    this.removeButton = this.removeButton.bind(this);
  }

  addHandler() {
    console.log('Add');
  }
  updateHandler() {
    console.log('Update');
  }
  handleChange(event) {
    this.setState({ value: event.target.value });
  }
  removeButton() {
    console.log('Remove');
    const dasboard = this.state.dashboard;
    dasboard.test();
  }
  render() {
    return (
      <form name="form">
        <div className="gf-form-group">
          <div className="gf-form">
            <span className="gf-form-label width-5">Name</span>
            <input
              type="text"
              className="gf-form-input width-10"
              name="name"
              placeholder="name"
              ng-model="ctrl.range.name"
              required
            />
          </div>
          <div className="gf-form">
            <span className="gf-form-label width-5">From</span>
            <input
              id="fromHourInput"
              type="number"
              min="0"
              max="23"
              step="1"
              className="gf-form-input width-3"
              name="fromHour"
              placeholder="08"
              required
            />
            <span>&nbsp;:&nbsp;</span>
            <input
              id="fromMinInput"
              type="number"
              min="0"
              max="59"
              step="1"
              className="gf-form-input width-3"
              name="fromMin"
              placeholder="00"
              required
            />
          </div>
          <div className="gf-form">
            <span className="gf-form-label width-5">To</span>
            <input
              id="toHourInput"
              type="number"
              min="0"
              max="23"
              step="1"
              className="gf-form-input width-3"
              name="toHour"
              placeholder="15"
              required
            />
            <span>&nbsp;:&nbsp;</span>
            <input
              id="toMinInput"
              type="number"
              min="0"
              max="59"
              step="1"
              className="gf-form-input width-3"
              name="toMin"
              placeholder="30"
              required
            />
          </div>
        </div>
        <div className="gf-form-group">
          <div className="gf-form">
            <span className="gf-form-label width-10">Starts a new day</span>
            <input type="checkbox" value="newDay" className="gf-form-switch" />
          </div>
        </div>
        <button className="btn btn-success" onClick={this.addHandler}>
          Add
        </button>
        <button className="btn btn-success" onClick={this.updateHandler}>
          Update
        </button>
      </form>
    );
  }
}
