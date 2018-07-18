import _ from 'lodash';
import React from 'react';
import { ThresholdEditor } from './ThresholdEditor';

const defaultThreshold: MultiStat.ThresholdModel = {
  value: null,
  mode: 'critical',
};

interface Props {
  thresholds: any[];
  onChange: (threshold: any) => any;
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
    const newThresholds = this.props.thresholds.concat(defaultThreshold);
    this.props.onChange(newThresholds);
  };

  sortThresholds(thresholds: MultiStat.ThresholdModel[]): MultiStat.ThresholdModel[] {
    return _.sortBy(thresholds, (t: MultiStat.ThresholdModel) => {
      return t.value !== null ? t.value : -Infinity;
    });
  }

  render() {
    const thresholdItems = this.props.thresholds.map((threshold: MultiStat.ThresholdModel, i) => (
      <ThresholdEditor
        index={i}
        key={i.toString()}
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
