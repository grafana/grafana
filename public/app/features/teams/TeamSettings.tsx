import React from 'react';
import { connect } from 'react-redux';
import { FormLabel, Input } from '@grafana/ui';

import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { updateTeam } from './state/actions';
import { getRouteParamsId } from 'app/core/selectors/location';
import { getTeam } from './state/selectors';
import { Team } from 'app/types';

export interface Props {
  team: Team;
  updateTeam: typeof updateTeam;
}

interface State {
  name: string;
  email: string;
}

export class TeamSettings extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      name: props.team.name,
      email: props.team.email,
    };
  }

  onChangeName = (event: any) => {
    this.setState({ name: event.target.value });
  };

  onChangeEmail = (event: any) => {
    this.setState({ email: event.target.value });
  };

  onUpdate = (event: any) => {
    const { name, email } = this.state;
    event.preventDefault();
    this.props.updateTeam(name, email);
  };

  render() {
    const { team } = this.props;
    const { name, email } = this.state;

    return (
      <div>
        <h3 className="page-sub-heading">Team Settings</h3>
        <form name="teamDetailsForm" className="gf-form-group" onSubmit={this.onUpdate}>
          <div className="gf-form max-width-30">
            <FormLabel>Name</FormLabel>
            <Input
              type="text"
              required
              value={name}
              className="gf-form-input max-width-22"
              onChange={this.onChangeName}
            />
          </div>

          <div className="gf-form max-width-30">
            <FormLabel tooltip="This is optional and is primarily used to set the team profile avatar (via gravatar service)">
              Email
            </FormLabel>
            <Input
              type="email"
              className="gf-form-input max-width-22"
              value={email}
              placeholder="team@email.com"
              onChange={this.onChangeEmail}
            />
          </div>

          <div className="gf-form-button-row">
            <button type="submit" className="btn btn-primary">
              Update
            </button>
          </div>
        </form>
        <SharedPreferences resourceUri={`teams/${team.id}`} />
      </div>
    );
  }
}

function mapStateToProps(state: any) {
  const teamId = getRouteParamsId(state.location);

  return {
    team: getTeam(state.team, teamId),
  };
}

const mapDispatchToProps = {
  updateTeam,
};

export default connect(mapStateToProps, mapDispatchToProps)(TeamSettings);
