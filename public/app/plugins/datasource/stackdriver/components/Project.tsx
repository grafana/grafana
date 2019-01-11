import React from 'react';
import StackdriverDatasource from '../datasource';

export interface Props {
  datasource: StackdriverDatasource;
}

interface State {
  projectName: string;
}

export class Project extends React.Component<Props, State> {
  state: State = {
    projectName: 'Loading project...',
  };

  async componentDidMount() {
    const projectName = await this.props.datasource.getDefaultProject();
    this.setState({ projectName });
  }

  render() {
    const { projectName } = this.state;
    return (
      <div className="gf-form">
        <span className="gf-form-label width-9 query-keyword">Project</span>
        <input className="gf-form-input width-15" disabled type="text" value={projectName} />
      </div>
    );
  }
}
