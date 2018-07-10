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
    return `Here you specify external groups that can be used as sync sources for
    members of this team. For example an LDAP group or a GitHub team
   `;
  }

  render() {
    const { isAdding } = this.state;
    const groups = this.props.team.groups.values();

    return (
      <div>
        <div className="page-action-bar">
          <h3 className="page-sub-heading">External group sync</h3>
          <Tooltip className="page-sub-heading-icon" placement="auto" content={this.getHeaderTooltip()}>
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
                <div className="gf-form-select-wrapper">
                  <select className="gf-form-input gf-size-auto" value={'ldap'}>
                    <option key="ldap" value="ldap">
                      LDAP Group
                    </option>
                  </select>
                </div>
                <input
                  type="text"
                  className="gf-form-input width-30"
                  placeholder="cn=ops,ou=groups,dc=grafana,dc=org"
                />
              </div>

              <div className="gf-form">
                <button className="btn btn-success gf-form-btn" type="submit">
                  Add group
                </button>
                <button className="btn btn-secondary gf-form-btn" type="submit">
                  Test
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
                <i className="fa fa-rocket" /> Sync LDAP or OAuth groups with your Grafana teams.
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
                  <th />
                  <th>Name</th>
                  <th>Email</th>
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
