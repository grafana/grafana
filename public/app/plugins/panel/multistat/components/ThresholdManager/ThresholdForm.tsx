import _ from 'lodash';
import React from 'react';
import * as MultiStatPanel from '../../types';
import { ThresholdEditor } from './ThresholdEditor';

const defaultThreshold: MultiStatPanel.ThresholdModel = {
  value: null,
  mode: 'critical',
};

interface Props {
  thresholds: MultiStatPanel.ThresholdModel[];
  onChange: (t: MultiStatPanel.ThresholdModel[]) => any;
}

interface State {
  focusedThresholdIndex: number;
}

export class ThresholdForm extends React.Component<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      focusedThresholdIndex: null,
    };
  }

  onChange = (threshold, index, valueChanged) => {
    const newThresholds = this.sortThresholds(this.props.thresholds);
    const updatedPosition = newThresholds.indexOf(threshold);
    this.setState({
      focusedThresholdIndex: valueChanged && updatedPosition,
    });
    this.props.onChange(newThresholds);
  };

  onRemove = index => {
    let newThresholds = this.props.thresholds.filter((t, i) => i !== index);
    this.props.onChange(newThresholds);
  };

  addThreshold = () => {
    const newThreshold = Object.assign({}, defaultThreshold);
    const newThresholds = this.props.thresholds.concat(newThreshold);
    this.props.onChange(newThresholds);
  };

  sortThresholds(thresholds: MultiStatPanel.ThresholdModel[]): MultiStatPanel.ThresholdModel[] {
    return _.sortBy(thresholds, (t: MultiStatPanel.ThresholdModel) => {
      return t.value !== null ? t.value : -Infinity;
    });
  }

  render() {
    const thresholdItems = this.props.thresholds.map((threshold: MultiStatPanel.ThresholdModel, i) => (
      <ThresholdEditor
        key={i.toString()}
        index={i}
        threshold={threshold}
        onChange={this.onChange}
        onRemove={this.onRemove}
        focused={this.state.focusedThresholdIndex === i}
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
