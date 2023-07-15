import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Input, Tooltip, Icon, Button, useTheme2, InlineField, InlineFieldRow } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { UpgradeBox, UpgradeContent, UpgradeContentProps } from 'app/core/components/Upgrade/UpgradeBox';
import { highlightTrial } from 'app/features/admin/utils';

import { StoreState, TeamGroup } from '../../types';

import { addTeamGroup, loadTeamGroups, removeTeamGroup } from './state/actions';
import { getTeamGroups } from './state/selectors';

function mapStateToProps(state: StoreState) {
  return {
    groups: getTeamGroups(state.team),
  };
}

const mapDispatchToProps = {
  loadTeamGroups,
  addTeamGroup,
  removeTeamGroup,
};

interface OwnProps {
  isReadOnly: boolean;
}

interface State {
  isAdding: boolean;
  newGroupId: string;
}

const connector = connect(mapStateToProps, mapDispatchToProps);
export type Props = OwnProps & ConnectedProps<typeof connector>;

const headerTooltip = `Sync LDAP, OAuth or SAML groups with your Grafana teams.`;

export class TeamGroupSync extends PureComponent<Props, State> {
  constructor(props: Props) {
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

  onNewGroupIdChanged = (event: any) => {
    this.setState({ newGroupId: event.target.value });
  };

  onAddGroup = (event: any) => {
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
    const { isReadOnly } = this.props;
    return (
      <tr key={group.groupId}>
        <td>{group.groupId}</td>
        <td style={{ width: '1%' }}>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => this.onRemoveGroup(group)}
            disabled={isReadOnly}
            aria-label={`Remove group ${group.groupId}`}
          >
            <Icon name="times" />
          </Button>
        </td>
      </tr>
    );
  }

  render() {
    const { isAdding, newGroupId } = this.state;
    const { groups, isReadOnly } = this.props;
    return (
      <div>
        {highlightTrial() && (
          <UpgradeBox
            featureId={'team-sync'}
            eventVariant={'trial'}
            featureName={'team sync'}
            text={'Add a group to enable team sync for free during your trial of Grafana Pro.'}
          />
        )}
        <div className="page-action-bar">
          {(!highlightTrial() || groups.length > 0) && (
            <>
              <h3 className="page-sub-heading">External group sync</h3>
              <Tooltip placement="auto" content={headerTooltip}>
                <Icon className="icon--has-hover page-sub-heading-icon" name="question-circle" />
              </Tooltip>
            </>
          )}
          <div className="page-action-bar__spacer" />
          {groups.length > 0 && (
            <Button className="pull-right" onClick={this.onToggleAdding} disabled={isReadOnly}>
              <Icon name="plus" /> Add group
            </Button>
          )}
        </div>

        <SlideDown in={isAdding}>
          <div className="cta-form">
            <CloseButton onClick={this.onToggleAdding} />
            <form onSubmit={this.onAddGroup}>
              <InlineFieldRow>
                <InlineField
                  label={'Add External Group'}
                  tooltip="LDAP Group Example: cn=users,ou=groups,dc=grafana,dc=org."
                >
                  <Input
                    type="text"
                    id={'add-external-group'}
                    placeholder=""
                    value={newGroupId}
                    onChange={this.onNewGroupIdChanged}
                    disabled={isReadOnly}
                  />
                </InlineField>
                <Button type="submit" disabled={isReadOnly || !this.isNewGroupValid()} style={{ marginLeft: 4 }}>
                  Add group
                </Button>
              </InlineFieldRow>
            </form>
          </div>
        </SlideDown>

        {groups.length === 0 &&
          !isAdding &&
          (highlightTrial() ? (
            <TeamSyncUpgradeContent action={{ onClick: this.onToggleAdding, text: 'Add group' }} />
          ) : (
            <EmptyListCTA
              onClick={this.onToggleAdding}
              buttonIcon="users-alt"
              title="There are no external groups to sync with"
              buttonTitle="Add group"
              proTip={headerTooltip}
              proTipLinkTitle="Learn more"
              proTipLink="https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-team-sync/"
              proTipTarget="_blank"
              buttonDisabled={isReadOnly}
            />
          ))}

        {groups.length > 0 && (
          <div className="admin-list-table">
            <table className="filter-table filter-table--hover form-inline">
              <thead>
                <tr>
                  <th>External Group ID</th>
                  <th style={{ width: '1%' }} />
                </tr>
              </thead>
              <tbody>{groups.map((group) => this.renderGroup(group))}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
}

export const TeamSyncUpgradeContent = ({ action }: { action?: UpgradeContentProps['action'] }) => {
  const theme = useTheme2();
  return (
    <UpgradeContent
      action={action}
      listItems={[
        'Stop managing user access in two places - assign users to groups in SAML, LDAP or Oauth, and manage access at a Team level in Grafana',
        'Update users’ permissions immediately when you add or remove them from an LDAP group, with no need for them to sign out and back in',
      ]}
      image={`team-sync-${theme.isLight ? 'light' : 'dark'}.png`}
      featureName={'team sync'}
      featureUrl={'https://grafana.com/docs/grafana/latest/enterprise/team-sync'}
      description={
        'Team Sync makes it easier for you to manage users’ access in Grafana, by immediately updating each user’s Grafana teams and permissions based on their single sign-on group membership, instead of when users sign in.'
      }
    />
  );
};
export default connect(mapStateToProps, mapDispatchToProps)(TeamGroupSync);
