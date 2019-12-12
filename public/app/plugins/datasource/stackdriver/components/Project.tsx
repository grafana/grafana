import React from 'react';
import StackdriverDatasource from '../datasource';
import { MetricSelect } from 'app/core/components/Select/MetricSelect';

export interface Props {
  datasource: StackdriverDatasource;
  onChange: (project: any) => void;
}

export interface State {
  value: string;
  projectList: any[];
}

export class Project extends React.Component<Props, State> {
  state: State = {
    projectList: ['Loading projects...'],
    value: '',
  };

  async componentDidMount() {
    const projectList = await this.props.datasource.getProjects();
    this.setState({ projectList });
  }

  onProjectChange = (project: string) => {
    this.props.onChange(project);
  };

  render() {
    const { projectList } = this.state;
    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <span className="gf-form-label width-9 query-keyword">Project</span>
          <MetricSelect
            onChange={this.onProjectChange}
            options={projectList}
            isSearchable={true}
            placeholder="Select Project"
            className="width-15"
          />
        </div>
        <div className="gf-form gf-form--grow">
          <div className="gf-form-label gf-form-label--grow" />
        </div>
      </div>
    );
  }
}
