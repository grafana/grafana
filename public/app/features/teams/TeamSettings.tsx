import React from 'react';
import { connect } from 'react-redux';
import { Label } from 'app/core/components/Forms/Forms';
import { Team } from '../../types';
import { updateTeam } from './state/actions';
import { getRouteParamsId } from '../../core/selectors/location';
import { getTeam } from './state/selectors';

export interface Props {
  team: Team;
  updateTeam: typeof updateTeam;
}

interface State {
  name: string;
  email: string;
}

export class TeamSettings extends React.Component<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      name: props.team.name,
      email: props.team.email,
    };
  }

  onChangeName = event => {
    this.setState({ name: event.target.value });
  };

  onChangeEmail = event => {
    this.setState({ email: event.target.value });
  };

  onUpdate = event => {
    const { name, email } = this.state;
    event.preventDefault();
    this.props.updateTeam(name, email);
  };

  render() {
    const { name, email } = this.state;

    return (
      <div>
        <h3 className="page-sub-heading">Team Settings</h3>
        <form name="teamDetailsForm" className="gf-form-group" onSubmit={this.onUpdate}>
          <div className="gf-form max-width-30">
            <Label>Name</Label>
            <input
              type="text"
              required
              value={name}
              className="gf-form-input max-width-22"
              onChange={this.onChangeName}
            />
          </div>
          <div className="gf-form max-width-30">
            <Label tooltip="This is optional and is primarily used to set the team profile avatar (via gravatar service)">
              Email
            </Label>
            <input
              type="email"
              className="gf-form-input max-width-22"
              value={email}
              placeholder="team@email.com"
              onChange={this.onChangeEmail}
            />
          </div>

          <div className="gf-form-button-row">
            <button type="submit" className="btn btn-success">
              Update
            </button>
          </div>
        </form>
      </div>
    );
  }
}

function mapStateToProps(state) {
  const teamId = getRouteParamsId(state.location);

  return {
    team: getTeam(state.team, teamId),
  };
}

const mapDispatchToProps = {
  updateTeam,
};

export default connect(mapStateToProps, mapDispatchToProps)(TeamSettings);
