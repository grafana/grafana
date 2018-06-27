import _ from 'lodash';
import React from 'react';
import { ThresholdModel, ThresholdMode } from './ThresholdEditor';
import { ThresholdEditor } from './ThresholdEditor';

export interface IProps {
  thresholds: any[];
  onChange: (threshold: any) => any;
}

export class ThresholdForm extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
  }

  onChange = (threshold, index) => {
    const newThresholds = this.sortThresholds(this.props.thresholds);
    this.props.onChange(newThresholds);
  };

  onRemove = index => {
    let newThresholds = this.props.thresholds.filter((t, i) => i !== index);
    this.props.onChange(newThresholds);
  };

  addThreshold = () => {
    const newThreshold: ThresholdModel = {
      value: undefined,
      mode: ThresholdMode.critical,
    };
    const newThresholds = this.props.thresholds.concat(newThreshold);
    this.props.onChange(newThresholds);
  };

  sortThresholds(thresholds: ThresholdModel[]) {
    return _.sortBy(thresholds, 'value');
  }

  render() {
    const thresholdItems = this.props.thresholds.map((threshold, i) => (
      <ThresholdEditor
        index={i}
        key={i.toString()}
        threshold={threshold}
        onChange={this.onChange}
        onRemove={this.onRemove}
        multipleAxes={false}
      />
    ));

    return (
      <div>
        {thresholdItems}
        <div className="gf-form-button-row">
          <button className="btn btn-inverse" onClick={this.addThreshold}>
            <i className="fa fa-plus" />&nbsp;Add Threshold
          </button>
        </div>
      </div>
    );
  }
}
