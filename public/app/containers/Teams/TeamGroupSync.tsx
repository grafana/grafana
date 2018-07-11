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
  newGroupId?: string;
}

const headerTooltip = `Sync LDAP or OAuth groups with your Grafana teams.`;

@observer
export class TeamGroupSync extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = { isAdding: false, newGroupId: '' };
  }

  componentDidMount() {
    this.props.team.loadGroups();
  }

  renderGroup(group: ITeamGroup) {
    return (
      <tr key={group.groupId}>
        <td>{group.groupId}</td>
        <td style={{ width: '1%' }}>
          <a className="btn btn-danger btn-mini" onClick={() => this.onRemoveGroup(group)}>
            <i className="fa fa-remove" />
          </a>
        </td>
      </tr>
    );
  }

  onToggleAdding = () => {
    this.setState({ isAdding: !this.state.isAdding });
  };

  onNewGroupIdChanged = evt => {
    this.setState({ newGroupId: evt.target.value });
  };

  onAddGroup = () => {
    this.props.team.addGroup(this.state.newGroupId);
    this.setState({ isAdding: false, newGroupId: '' });
  };

  onRemoveGroup = (group: ITeamGroup) => {
    this.props.team.removeGroup(group.groupId);
  };

  isNewGroupValid() {
    return this.state.newGroupId.length > 1;
  }

  render() {
    const { isAdding, newGroupId } = this.state;
    const groups = this.props.team.groups.values();

    return (
      <div>
        <div className="page-action-bar">
          <h3 className="page-sub-heading">External group sync</h3>
          <Tooltip className="page-sub-heading-icon" placement="auto" content={headerTooltip}>
            <i className="gicon gicon-question gicon--has-hover" />
          </Tooltip>
          <div className="page-action-bar__spacer" />
          {groups.length > 0 && (
            <button className="btn btn-success pull-right" onClick={this.onToggleAdding}>
              <i className="fa fa-plus" /> Add group
            </button>
          )}
        </div>

        <SlideDown in={isAdding}>
          <div className="cta-form">
            <button className="cta-form__close btn btn-transparent" onClick={this.onToggleAdding}>
              <i className="fa fa-close" />
            </button>
            <h5>Add External Group</h5>
            <div className="gf-form-inline">
              <div className="gf-form">
                <input
                  type="text"
                  className="gf-form-input width-30"
                  value={newGroupId}
                  onChange={this.onNewGroupIdChanged}
                  placeholder="cn=ops,ou=groups,dc=grafana,dc=org"
                />
              </div>

              <div className="gf-form">
                <button
                  className="btn btn-success gf-form-btn"
                  onClick={this.onAddGroup}
                  type="submit"
                  disabled={!this.isNewGroupValid()}
                >
                  Add group
                </button>
              </div>
            </div>
          </div>
        </SlideDown>

        {groups.length === 0 &&
          !isAdding && (
            <div className="empty-list-cta">
              <div className="empty-list-cta__title">There are no external groups to sync with</div>
              <button onClick={this.onToggleAdding} className="empty-list-cta__button btn btn-xlarge btn-success">
                <i className="gicon gicon-add-team" />
                Add Group
              </button>
              <div className="empty-list-cta__pro-tip">
                <i className="fa fa-rocket" /> {headerTooltip}
                <a className="text-link empty-list-cta__pro-tip-link" href="asd" target="_blank">
                  Learn more
                </a>
              </div>
            </div>
          )}

        {groups.length > 0 && (
          <div className="admin-list-table">
            <table className="filter-table filter-table--hover form-inline">
              <thead>
                <tr>
                  <th>External Group ID</th>
                  <th style={{ width: '1%' }} />
                </tr>
              </thead>
              <tbody>{groups.map(group => this.renderGroup(group))}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
}

export default hot(module)(TeamGroupSync);
