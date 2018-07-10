import React from 'react';
import { hot } from 'react-hot-loader';
import { observer } from 'mobx-react';
import { ITeam, ITeamGroup } from 'app/stores/TeamsStore/TeamsStore';
import SlideDown from 'app/core/components/Animations/SlideDown';
import Tooltip from 'app/core/components/Tooltip/Tooltip';

interface Props {
  team: ITeam;
}

interface State {
  isAdding: boolean;
}

@observer
export class TeamGroupSync extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = { isAdding: false };
  }

  componentDidMount() {
    this.props.team.loadGroups();
  }

  renderGroup(group: ITeamGroup) {
    return (
      <tr key={group.groupId}>
        <td>{group.groupId}</td>
        <td style={{ width: '1%' }}>
          <a className="btn btn-danger btn-mini">
            <i className="fa fa-remove" />
          </a>
        </td>
      </tr>
    );
  }

  onToggleAdding = () => {
    this.setState({ isAdding: !this.state.isAdding });
  };

  getHeaderTooltip() {
    return `You can here specify external groups that can be used as source for
    members of this team. For example an LDAP group or a GitHub team
   `;
  }

  render() {
    const groups = this.props.team.groups.values();

    return (
      <div>
        <div className="page-action-bar">
          <h3 className="page-sub-heading">External group sync</h3>
          <Tooltip className="page-sub-heading-icon" placement="auto" content={this.getHeaderTooltip()}>
            <i className="gicon gicon-question gicon--has-hover" />
          </Tooltip>
          <div className="page-action-bar__spacer" />
          <button className="btn btn-success pull-right" onClick={this.onToggleAdding}>
            <i className="fa fa-plus" /> Add group
          </button>
        </div>

        <SlideDown in={this.state.isAdding}>
          <div className="cta-form">
            <button className="cta-form__close btn btn-transparent" onClick={this.onToggleAdding}>
              <i className="fa fa-close" />
            </button>
            <h5>Add Team Member</h5>
            <div className="gf-form-inline" />
          </div>
        </SlideDown>

        <div className="admin-list-table">
          <table className="filter-table filter-table--hover form-inline">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Email</th>
                <th style={{ width: '1%' }} />
              </tr>
            </thead>
            <tbody>{groups.map(group => this.renderGroup(group))}</tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default hot(module)(TeamGroupSync);
