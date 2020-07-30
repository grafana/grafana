import React from 'react';
import { SelectableValue } from '@grafana/data';
import { SegmentAsync } from '@grafana/ui';
import CloudMonitoringDatasource from '../datasource';

export interface Props {
  datasource: CloudMonitoringDatasource;
  onChange: (projectName: string) => void;
  templateVariableOptions: Array<SelectableValue<string>>;
  projectName: string;
}

export function Project({ projectName, datasource, onChange, templateVariableOptions }: Props) {
  return (
    <div className="gf-form-inline">
      <span className="gf-form-label width-9 query-keyword">Project</span>
      <SegmentAsync
        allowCustomValue
        onChange={({ value }) => onChange(value!)}
        loadOptions={() =>
          datasource.getProjects().then(projects => [
            {
              label: 'Template Variables',
              options: templateVariableOptions,
            },
            ...projects,
          ])
        }
        value={projectName}
        placeholder="Select Project"
      />
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow" />
      </div>
    </div>
  );
}
