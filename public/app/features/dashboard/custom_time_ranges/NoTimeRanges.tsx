import React, { PureComponent } from 'react';

export interface Props {
  add: any;
}

export default class NoTimeRanges extends PureComponent<Props> {
  clickAdd = () => {
    this.props.add();
  };

  render() {
    return (
      <div className="empty-list-cta">
        <div className="empty-list-cta__title">There are no time ranges added yet</div>
        <a onClick={this.clickAdd} className="empty-list-cta__button btn btn-xlarge btn-success">
          <i className="fa fa-clock-o" />
          Add Time Range
        </a>
        <div className="grafana-info-box">
          <h5>What are Custom Time Ranges?</h5>
          <p>
            Custom Time Ranges allow you to define and browse your own ranges easily! Your ranges will be added to
            timepicker for quick and convenient access.
          </p>
        </div>
      </div>
    );
  }
}
