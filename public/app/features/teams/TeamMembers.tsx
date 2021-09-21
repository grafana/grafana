import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { TeamMember, OrgUser } from 'app/types';
import { addTeamMember } from './state/actions';
import { getSearchMemberQuery, isSignedInUserTeamAdmin } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { WithFeatureToggle } from 'app/core/components/WithFeatureToggle';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import TeamMemberRow from './TeamMemberRow';
import { setSearchMemberQuery } from './state/reducers';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { Button } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

function mapStateToProps(state: any) {
  return {
    searchMemberQuery: getSearchMemberQuery(state.team),
    editorsCanAdmin: config.editorsCanAdmin, // this makes the feature toggle mockable/controllable from tests,
    signedInUser: contextSrv.user, // this makes the feature toggle mockable/controllable from tests,
  };
}

const mapDispatchToProps = {
  addTeamMember,
  setSearchMemberQuery,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {
  members: TeamMember[];
  syncEnabled: boolean;
}

export type Props = ConnectedProps<typeof connector> & OwnProps;

export interface State {
  isAdding: boolean;
  newTeamMember?: SelectableValue<OrgUser['userId']> | null;
}

export class TeamMembers extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { isAdding: false, newTeamMember: null };
  }

  onSearchQueryChange = (value: string) => {
    this.props.setSearchMemberQuery(value);
  };

  onToggleAdding = () => {
    this.setState({ isAdding: !this.state.isAdding });
  };

  onUserSelected = (user: SelectableValue<OrgUser['userId']>) => {
    this.setState({ newTeamMember: user });
  };

  onAddUserToTeam = async () => {
    this.props.addTeamMember(this.state.newTeamMember!.id);
    this.setState({ newTeamMember: null });
  };

  renderLabels(labels: string[]) {
    if (!labels) {
      return <td />;
    }

    return (
      <td>
        {labels.map((label) => (
          <TagBadge key={label} label={label} removeIcon={false} count={0} onClick={() => {}} />
        ))}
      </td>
    );
  }

  render() {
    const { isAdding } = this.state;
    const { searchMemberQuery, members, syncEnabled, editorsCanAdmin, signedInUser } = this.props;
    const isTeamAdmin = isSignedInUserTeamAdmin({ members, editorsCanAdmin, signedInUser });

    return (
      <div>
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <FilterInput placeholder="Search members" value={searchMemberQuery} onChange={this.onSearchQueryChange} />
          </div>
          <Button className="pull-right" onClick={this.onToggleAdding} disabled={isAdding || !isTeamAdmin}>
            Add member
          </Button>
        </div>

        <SlideDown in={isAdding}>
          <div className="cta-form">
            <CloseButton onClick={this.onToggleAdding} />
            <h5>Add team member</h5>
            <div className="gf-form-inline">
              <UserPicker onSelected={this.onUserSelected} className="min-width-30" />
              {this.state.newTeamMember && (
                <Button type="submit" onClick={this.onAddUserToTeam}>
                  Add to team
                </Button>
              )}
            </div>
          </div>
        </SlideDown>

        <div className="admin-list-table">
          <table className="filter-table filter-table--hover form-inline">
            <thead>
              <tr>
                <th />
                <th>Login</th>
                <th>Email</th>
                <th>Name</th>
                <WithFeatureToggle featureToggle={editorsCanAdmin}>
                  <th>Permission</th>
                </WithFeatureToggle>
                {syncEnabled && <th />}
                <th style={{ width: '1%' }} />
              </tr>
            </thead>
            <tbody>
              {members &&
                members.map((member) => (
                  <TeamMemberRow
                    key={member.userId}
                    member={member}
                    syncEnabled={syncEnabled}
                    editorsCanAdmin={editorsCanAdmin}
                    signedInUserIsTeamAdmin={isTeamAdmin}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default connector(TeamMembers);
