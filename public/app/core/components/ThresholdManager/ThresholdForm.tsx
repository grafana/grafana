import React from 'react';
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
    this.props.onChange(this.props.thresholds);
  };

  onRemove = index => {
    let newThresholds = this.props.thresholds.filter((t, i) => i !== index);
    this.props.onChange(newThresholds);
  };

  addThreshold = () => {
    let newThresholds = this.props.thresholds.concat({
      value: undefined,
      colorMode: 'critical',
      op: 'gt',
      fill: true,
      line: true,
      yaxis: 'left',
    });
    this.props.onChange(newThresholds);
  };

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
