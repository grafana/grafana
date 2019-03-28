import React, { PureComponent } from 'react';
import { connect } from 'react-redux';

import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { Input, Tooltip } from '@grafana/ui';

import { TeamGroup } from '../../types';
import { addTeamGroup, loadTeamGroups, removeTeamGroup } from './state/actions';
import { getTeamGroups } from './state/selectors';

export interface Props {
  groups: TeamGroup[];
  loadTeamGroups: typeof loadTeamGroups;
  addTeamGroup: typeof addTeamGroup;
  removeTeamGroup: typeof removeTeamGroup;
}

interface State {
  isAdding: boolean;
  newGroupId?: string;
}

const headerTooltip = `Sync LDAP or OAuth groups with your Grafana teams.`;

export class TeamGroupSync extends PureComponent<Props, State> {
  constructor(props) {
    super(props);
    this.state = { isAdding: false, newGroupId: '' };
  }

  componentDidMount() {
    this.fetchTeamGroups();
  }

  async fetchTeamGroups() {
    await this.props.loadTeamGroups();
  }

  onToggleAdding = () => {
    this.setState({ isAdding: !this.state.isAdding });
  };

  onNewGroupIdChanged = event => {
    this.setState({ newGroupId: event.target.value });
  };

  onAddGroup = event => {
    event.preventDefault();
    this.props.addTeamGroup(this.state.newGroupId);
    this.setState({ isAdding: false, newGroupId: '' });
  };

  onRemoveGroup = (group: TeamGroup) => {
    this.props.removeTeamGroup(group.groupId);
  };

  isNewGroupValid() {
    return this.state.newGroupId.length > 1;
  }

  renderGroup(group: TeamGroup) {
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

  render() {
    const { isAdding, newGroupId } = this.state;
    const groups = this.props.groups;

    return (
      <div>
        <div className="page-action-bar">
          <h3 className="page-sub-heading">External group sync</h3>
          <Tooltip placement="auto" content={headerTooltip}>
            <div className="page-sub-heading-icon">
              <i className="gicon gicon-question gicon--has-hover" />
            </div>
          </Tooltip>
          <div className="page-action-bar__spacer" />
          {groups.length > 0 && (
            <button className="btn btn-primary pull-right" onClick={this.onToggleAdding}>
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
            <form className="gf-form-inline" onSubmit={this.onAddGroup}>
              <div className="gf-form">
                <Input
                  type="text"
                  className="gf-form-input width-30"
                  value={newGroupId}
                  onChange={this.onNewGroupIdChanged}
                  placeholder="cn=ops,ou=groups,dc=grafana,dc=org"
                />
              </div>

              <div className="gf-form">
                <button className="btn btn-primary gf-form-btn" type="submit" disabled={!this.isNewGroupValid()}>
                  Add group
                </button>
              </div>
            </form>
          </div>
        </SlideDown>

        {groups.length === 0 && !isAdding && (
          <div className="empty-list-cta">
            <div className="empty-list-cta__title">There are no external groups to sync with</div>
            <button onClick={this.onToggleAdding} className="empty-list-cta__button btn btn-xlarge btn-primary">
              <i className="gicon gicon-add-team" />
              Add Group
            </button>
            <div className="empty-list-cta__pro-tip">
              <i className="fa fa-rocket" /> {headerTooltip}
              <a
                className="text-link empty-list-cta__pro-tip-link"
                href="http://docs.grafana.org/auth/enhanced_ldap/"
                target="_blank"
              >
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

function mapStateToProps(state) {
  return {
    groups: getTeamGroups(state.team),
  };
}

const mapDispatchToProps = {
  loadTeamGroups,
  addTeamGroup,
  removeTeamGroup,
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TeamGroupSync);
