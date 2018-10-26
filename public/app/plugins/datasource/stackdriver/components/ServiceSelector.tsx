import React, { SFC } from 'react';
import { extractServicesFromMetricDescriptors } from '../functions';

interface Props {
  onServiceChange: any;
  metricDescriptors: any[];
}

const ServiceSelector: SFC<Props> = props => {
  const extractServices = () => {
    return extractServicesFromMetricDescriptors(props.metricDescriptors).map(m => ({
      value: m.service,
      name: m.serviceShortName,
    }));
  };

  return (
    <div className="gf-form max-width-21">
      <span className="gf-form-label width-7">Service</span>
      <div className="gf-form-select-wrapper max-width-14">
        <select className="gf-form-input" required onChange={props.onServiceChange}>
          {extractServices().map((qt, i) => (
            <option key={i} value={qt.value} ng-if="false">
              {qt.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ServiceSelector;
