import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import SlideDown from 'app/core/components/Animations/SlideDown';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { TeamMember, User, TeamPermissionLevel, OrgRole } from 'app/types';
import { loadTeamMembers, addTeamMember, setSearchMemberQuery } from './state/actions';
import { getSearchMemberQuery, getTeamMembers } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { WithFeatureToggle } from 'app/core/components/WithFeatureToggle';
import { config } from 'app/core/config';
import { contextSrv, User as SignedInUser } from 'app/core/services/context_srv';
import TeamMemberRow from './TeamMemberRow';

export interface Props {
  members: TeamMember[];
  searchMemberQuery: string;
  loadTeamMembers: typeof loadTeamMembers;
  addTeamMember: typeof addTeamMember;
  setSearchMemberQuery: typeof setSearchMemberQuery;
  syncEnabled: boolean;
  editorsCanAdmin?: boolean;
  signedInUser?: SignedInUser;
}

export interface State {
  isAdding: boolean;
  newTeamMember?: User;
}

export class TeamMembers extends PureComponent<Props, State> {
  constructor(props) {
    super(props);
    this.state = { isAdding: false, newTeamMember: null };
  }

  componentDidMount() {
    this.props.loadTeamMembers();
  }

  onSearchQueryChange = (value: string) => {
    this.props.setSearchMemberQuery(value);
  };

  onToggleAdding = () => {
    this.setState({ isAdding: !this.state.isAdding });
  };

  onUserSelected = (user: User) => {
    this.setState({ newTeamMember: user });
  };

  onAddUserToTeam = async () => {
    this.props.addTeamMember(this.state.newTeamMember.id);
    this.setState({ newTeamMember: null });
  };

  renderLabels(labels: string[]) {
    if (!labels) {
      return <td />;
    }

    return (
      <td>
        {labels.map(label => (
          <TagBadge key={label} label={label} removeIcon={false} count={0} onClick={() => {}} />
        ))}
      </td>
    );
  }

  isSignedInUserTeamAdmin = (): boolean => {
    const { members, editorsCanAdmin, signedInUser } = this.props;
    const userInMembers = members.find(m => m.userId === signedInUser.id);
    const isAdmin = signedInUser.isGrafanaAdmin || signedInUser.orgRole === OrgRole.Admin;
    const userIsTeamAdmin = userInMembers && userInMembers.permission === TeamPermissionLevel.Admin;
    const isSignedInUserTeamAdmin = isAdmin || userIsTeamAdmin;

    return isSignedInUserTeamAdmin || !editorsCanAdmin;
  };

  render() {
    const { isAdding } = this.state;
    const { searchMemberQuery, members, syncEnabled, editorsCanAdmin } = this.props;
    return (
      <div>
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <FilterInput
              labelClassName="gf-form--has-input-icon gf-form--grow"
              inputClassName="gf-form-input"
              placeholder="Search members"
              value={searchMemberQuery}
              onChange={this.onSearchQueryChange}
            />
          </div>

          <div className="page-action-bar__spacer" />

          <button
            className="btn btn-primary pull-right"
            onClick={this.onToggleAdding}
            disabled={isAdding || !this.isSignedInUserTeamAdmin()}
          >
            Add member
          </button>
        </div>

        <SlideDown in={isAdding}>
          <div className="cta-form">
            <button className="cta-form__close btn btn-transparent" onClick={this.onToggleAdding}>
              <i className="fa fa-close" />
            </button>
            <h5>Add team member</h5>
            <div className="gf-form-inline">
              <UserPicker onSelected={this.onUserSelected} className="min-width-30" />
              {this.state.newTeamMember && (
                <button className="btn btn-primary gf-form-btn" type="submit" onClick={this.onAddUserToTeam}>
                  Add to team
                </button>
              )}
            </div>
          </div>
        </SlideDown>

        <div className="admin-list-table">
          <table className="filter-table filter-table--hover form-inline">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Email</th>
                <WithFeatureToggle featureToggle={editorsCanAdmin}>
                  <th>Permission</th>
                </WithFeatureToggle>
                {syncEnabled && <th />}
                <th style={{ width: '1%' }} />
              </tr>
            </thead>
            <tbody>
              {members &&
                members.map(member => (
                  <TeamMemberRow
                    key={member.userId}
                    member={member}
                    syncEnabled={syncEnabled}
                    editorsCanAdmin={editorsCanAdmin}
                    signedInUserIsTeamAdmin={this.isSignedInUserTeamAdmin()}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    members: getTeamMembers(state.team),
    searchMemberQuery: getSearchMemberQuery(state.team),
    editorsCanAdmin: config.editorsCanAdmin, // this makes the feature toggle mockable/controllable from tests,
    signedInUser: contextSrv.user, // this makes the feature toggle mockable/controllable from tests,
  };
}

const mapDispatchToProps = {
  loadTeamMembers,
  addTeamMember,
  setSearchMemberQuery,
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TeamMembers);
