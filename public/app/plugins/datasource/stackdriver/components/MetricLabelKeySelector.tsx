import React, { SFC } from 'react';

interface Props {
  onMetricLabelKeyChange: any;
  metricLabels: any;
  metricLabelKey: string;
}

const MetricLabelKeySelector: SFC<Props> = props => {
  return (
    <div className="gf-form max-width-21">
      <span className="gf-form-label width-7">Metric Labels</span>
      <div className="gf-form-select-wrapper max-width-14">
        <select className="gf-form-input" required onChange={props.onMetricLabelKeyChange}>
          {props.metricLabels.map((qt, i) => (
            <option key={i} value={qt} ng-if="false">
              {qt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MetricLabelKeySelector;
