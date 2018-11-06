import React from 'react';

export interface Props {
  ranges: any;
  add: any;
  update: any;
}

export default class TimeRangeEditor extends React.Component<Props> {
  constructor(props) {
    super(props);
  }

  add = () => {
    this.props.add();
  };
  update = () => {
    this.props.update();
  };

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
        <a className="btn btn-success" onClick={this.add}>
          Add
        </a>
        <a className="btn btn-success" onClick={this.update}>
          Update
        </a>
      </form>
    );
  }
}
