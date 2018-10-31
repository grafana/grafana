import React, { SFC } from 'react';
import { getMetricTypesByService } from '../functions';

interface Props {
  onMetricTypeChange: any;
  selectedService: string;
  selectedMetricType: string;
  metricDescriptors: any[];
  metricTypes: any[];
}

const MetricTypePicker: SFC<Props> = props => {
  const filterMetricTypes = () => {
    if (!props.selectedService) {
      return [];
    }

    return getMetricTypesByService(props.metricDescriptors, props.selectedService).map(m => ({
      value: m.type,
      name: m.displayName,
    }));
  };

  return (
    <div className="gf-form max-width-21">
      <span className="gf-form-label width-7">Metric Types</span>
      <div className="gf-form-select-wrapper max-width-14">
        <select className="gf-form-input" value={props.selectedMetricType} onChange={props.onMetricTypeChange}>
          {filterMetricTypes().map((qt, i) => (
            <option key={i} value={qt.value} ng-if="false">
              {qt.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MetricTypePicker;
