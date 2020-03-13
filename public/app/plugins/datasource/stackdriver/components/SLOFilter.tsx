import React, { FunctionComponent } from 'react';
import _ from 'lodash';
import { SelectableValue } from '@grafana/data';
import { Segment, SegmentAsync } from '@grafana/ui';
import StackdriverDatasource from '../datasource';
import { SLOQuery } from '../types';

export interface Props {
  query: SLOQuery;
  onChange: (slo: SLOQuery) => void;
  templateVariableOptions: Array<SelectableValue<string>>;
  datasource: StackdriverDatasource;
}

const selectors = [
  { label: 'SLI Value', value: 'select_slo_health' },
  { label: 'SLO Compliance', value: 'select_slo_compliance' },
  { label: 'SLO Error Budget Remaining ', value: 'select_slo_budget' },
];

export const SLOFilter: FunctionComponent<Props> = ({ templateVariableOptions, query, onChange, datasource }) => {
  return (
    <>
      <div className="gf-form-inline">
        <label className="gf-form-label query-keyword width-9">Service</label>
        <SegmentAsync
          allowCustomValue
          value={query?.serviceId}
          placeholder="Select service"
          loadOptions={() =>
            datasource.getSLOServices(query.projectName).then(services => [
              {
                label: 'Template Variables',
                options: templateVariableOptions,
              },
              ...services,
            ])
          }
          onChange={({ value: serviceId }) => {
            console.log({ serviceId });
            onChange({ ...query, serviceId });
          }}
        />
        <div className="gf-form gf-form--grow">
          <label className="gf-form-label gf-form-label--grow"></label>
        </div>
      </div>

      <div className="gf-form-inline">
        <label className="gf-form-label query-keyword width-9">SLO</label>
        <SegmentAsync
          allowCustomValue
          value={query?.sloId}
          placeholder="Select SLO"
          loadOptions={() =>
            datasource.getServiceLevelObjectives(query.projectName, query.serviceId).then(sloIds => [
              {
                label: 'Template Variables',
                options: templateVariableOptions,
              },
              ...sloIds,
            ])
          }
          onChange={({ value: sloId }) => onChange({ ...query, sloId })}
        />
        <div className="gf-form gf-form--grow">
          <label className="gf-form-label gf-form-label--grow"></label>
        </div>
      </div>

      <div className="gf-form-inline">
        <label className="gf-form-label query-keyword width-9">Selector</label>
        <Segment
          allowCustomValue
          value={[...selectors, ...templateVariableOptions].find(s => s.value === query?.selectorName ?? '')}
          options={[
            {
              label: 'Template Variables',
              options: templateVariableOptions,
            },
            ...selectors,
          ]}
          onChange={({ value: selectorName }) => onChange({ ...query, selectorName })}
        />
        <div className="gf-form gf-form--grow">
          <label className="gf-form-label gf-form-label--grow"></label>
        </div>
      </div>
    </>
  );
};
