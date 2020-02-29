import React from 'react';
import { SegmentAsync } from '@grafana/ui';
import StackdriverDatasource from '../datasource';

export interface Props {
  datasource: StackdriverDatasource;
  onChange: (project: string) => void;
  project: string;
}

export function Project({ project, datasource, onChange }: Props) {
  return (
    <div className="gf-form-inline">
      <span className="gf-form-label width-9 query-keyword">Project</span>
      <SegmentAsync
        allowCustomValue
        onChange={({ value }) => onChange(value)}
        loadOptions={() => datasource.getProjects()}
        value={project}
        placeholder="Select Project"
      />
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow" />
      </div>
    </div>
  );
}
