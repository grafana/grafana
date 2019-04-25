import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { DeleteButton, Select, SelectOptionItem } from '@grafana/ui';

import { TeamMember, teamsPermissionLevels, TeamPermissionLevel } from 'app/types';
import { WithFeatureToggle } from 'app/core/components/WithFeatureToggle';
import { updateTeamMember, removeTeamMember } from './state/actions';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';

export interface Props {
  member: TeamMember;
  syncEnabled: boolean;
  editorsCanAdmin: boolean;
  signedInUserIsTeamAdmin: boolean;
  removeTeamMember?: typeof removeTeamMember;
  updateTeamMember?: typeof updateTeamMember;
}

export class TeamMemberRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
    this.renderLabels = this.renderLabels.bind(this);
    this.renderPermissions = this.renderPermissions.bind(this);
  }

  onRemoveMember(member: TeamMember) {
    this.props.removeTeamMember(member.userId);
  }

  onPermissionChange = (item: SelectOptionItem<TeamPermissionLevel>, member: TeamMember) => {
    const permission = item.value;
    const updatedTeamMember = { ...member, permission };

    this.props.updateTeamMember(updatedTeamMember);
  };

  renderPermissions(member: TeamMember) {
    const { editorsCanAdmin, signedInUserIsTeamAdmin } = this.props;
    const value = teamsPermissionLevels.find(dp => dp.value === member.permission);

    return (
      <WithFeatureToggle featureToggle={editorsCanAdmin}>
        <td className="width-5 team-permissions">
          <div className="gf-form">
            {signedInUserIsTeamAdmin && (
              <Select
                isSearchable={false}
                options={teamsPermissionLevels}
                onChange={item => this.onPermissionChange(item, member)}
                className="gf-form-select-box__control--menu-right"
                value={value}
              />
            )}
            {!signedInUserIsTeamAdmin && <span>{value.label}</span>}
          </div>
        </td>
      </WithFeatureToggle>
    );
  }

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

  render() {
    const { member, syncEnabled, signedInUserIsTeamAdmin } = this.props;
    return (
      <tr key={member.userId}>
        <td className="width-4 text-center">
          <img className="filter-table__avatar" src={member.avatarUrl} />
        </td>
        <td>{member.login}</td>
        <td>{member.email}</td>
        {this.renderPermissions(member)}
        {syncEnabled && this.renderLabels(member.labels)}
        <td className="text-right">
          <DeleteButton onConfirm={() => this.onRemoveMember(member)} disabled={!signedInUserIsTeamAdmin} />
        </td>
      </tr>
    );
  }
}

function mapStateToProps(state) {
  return {};
}

const mapDispatchToProps = {
  removeTeamMember,
  updateTeamMember,
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TeamMemberRow);
