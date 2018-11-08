import React, { PureComponent } from 'react';
import RangeModel from './range_model';

export interface Props {
  range: RangeModel;
  mode: string;
  add: any;
  update: any;
}

export default class TimeRangeEditor extends PureComponent<Props> {
  add = () => {
    this.props.add(this.state);
  };
  update = () => {
    this.props.update(this.state);
  };
  onChange = e => {
    this.setState({
      [e.target.name]: e.target.value,
    });
  };
  onSubmit = e => {
    e.preventDefault();
    if (this.props.mode === 'new') {
      this.add();
    }
    if (this.props.mode === 'edit') {
      this.update();
    }
  };

  render() {
    const mode = this.props.mode;
    return (
      <form name="form" onSubmit={this.onSubmit}>
        <div className="gf-form-group">
          <div className="gf-form">
            <span className="gf-form-label width-5">Name</span>
            <input
              name="name"
              onBlur={this.onChange}
              type="text"
              className="gf-form-input width-10"
              placeholder="name"
              required
            />
          </div>
          <div className="gf-form">
            <span className="gf-form-label width-5">From</span>
            <input
              name="fromHour"
              onBlur={this.onChange}
              type="number"
              min="0"
              max="23"
              step="1"
              className="gf-form-input width-3"
              placeholder="08"
              required
            />
            <span>&nbsp;:&nbsp;</span>
            <input
              name="fromMin"
              onBlur={this.onChange}
              type="number"
              min="0"
              max="59"
              step="1"
              className="gf-form-input width-3"
              placeholder="00"
              required
            />
          </div>
          <div className="gf-form">
            <span className="gf-form-label width-5">To</span>
            <input
              name="toHour"
              onBlur={this.onChange}
              type="number"
              min="0"
              max="23"
              step="1"
              className="gf-form-input width-3"
              placeholder="15"
              required
            />
            <span>&nbsp;:&nbsp;</span>
            <input
              name="toMin"
              onBlur={this.onChange}
              type="number"
              min="0"
              max="59"
              step="1"
              className="gf-form-input width-3"
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
        {mode === 'new' ? <button className="btn btn-success">Add</button> : null}
        {mode === 'edit' ? <button className="btn btn-success">Update</button> : null}
      </form>
    );
  }
}
