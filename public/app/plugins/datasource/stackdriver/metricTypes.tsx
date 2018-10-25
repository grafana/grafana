import React, { SFC } from 'react';

interface Props {
  onMetricTypeChanged: any;
  selectedService: string;
  metricDescriptors: any[];
}

const MetricTypes: SFC<Props> = props => {
  const extractMetricTypes = () => {
    if (!props.selectedService) {
      return [];
    }

    return props.metricDescriptors.filter(m => m.service === props.selectedService).map(m => ({
      value: m.service,
      name: m.displayName,
    }));
  };

  return (
    <div className="gf-form max-width-21">
      <span className="gf-form-label width-7">Metric Types</span>
      <div className="gf-form-select-wrapper max-width-14">
        <select className="gf-form-input" required onChange={props.onMetricTypeChanged}>
          {extractMetricTypes().map((qt, i) => (
            <option key={i} value={qt.value} ng-if="false">
              {qt.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MetricTypes;
