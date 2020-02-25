import React from 'react';
import StackdriverDatasource from '../datasource';
import { SegmentAsync } from '@grafana/ui';

export interface Props {
  datasource: StackdriverDatasource;
  onChange: (project: any) => void;
  defaultProject: string;
}

export class Project extends React.Component<Props> {
  render() {
    const { defaultProject } = this.props;
    return (
      <div className="gf-form-inline">
        <span className="gf-form-label width-9 query-keyword">Project</span>
        <SegmentAsync
          onChange={({ value }) => this.props.onChange(value)}
          loadOptions={() => this.props.datasource.getProjects()}
          value={defaultProject}
          placeholder="Select Project"
        />
        <div className="gf-form gf-form--grow">
          <div className="gf-form-label gf-form-label--grow" />
        </div>
      </div>
    );
  }
}
