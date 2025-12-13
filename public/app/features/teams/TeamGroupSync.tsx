import { css, cx } from '@emotion/css';
import { FormEventHandler, useState } from 'react';

import { TeamGroupDto } from '@grafana/api-clients/rtkq/legacy';
import { Trans, t } from '@grafana/i18n';
import { Input, Tooltip, Icon, Button, useTheme2, InlineField, InlineFieldRow } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { UpgradeBox, UpgradeContent, UpgradeContentProps } from 'app/core/components/Upgrade/UpgradeBox';
import { highlightTrial } from 'app/features/admin/utils';

import { useAddTeamGroup, useGetTeamGroups, useRemoveTeamGroup } from './hooks';

interface Props {
  isReadOnly: boolean;
  teamUid: string;
}

const headerTooltip = `Sync LDAP, OAuth or SAML groups with your Grafana teams.`;

export const TeamGroupSync = ({ isReadOnly, teamUid }: Props) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newGroupId, setNewGroupId] = useState('');
  const styles = getStyles();

  const { value: groups = [], retry: fetchTeamGroups } = useGetTeamGroups(teamUid);
  const [addTeamGroup] = useAddTeamGroup();
  const [removeTeamGroup] = useRemoveTeamGroup();

  const onToggleAdding = () => {
    setIsAdding(!isAdding);
  };

  const onNewGroupIdChanged: FormEventHandler<HTMLInputElement> = (event) => {
    setNewGroupId(event.currentTarget.value);
  };

  const onAddGroup: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    await addTeamGroup(teamUid, newGroupId);
    fetchTeamGroups();
    setIsAdding(false);
    setNewGroupId('');
  };

  const onRemoveGroup = async (groupId: string | undefined) => {
    if (!groupId) {
      return;
    }
    await removeTeamGroup(teamUid, groupId);
    fetchTeamGroups();
  };

  const isNewGroupValid = () => {
    return newGroupId.length > 1;
  };

  const renderGroup = (group: TeamGroupDto) => {
    return (
      <tr key={group.groupId}>
        <td>{group.groupId}</td>
        <td style={{ width: '1%' }}>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onRemoveGroup(group.groupId)}
            disabled={isReadOnly}
            aria-label={t('teams.team-group-sync.aria-label-remove', 'Remove group {{groupName}}', {
              groupName: group.groupId,
            })}
          >
            <Icon name="times" />
          </Button>
        </td>
      </tr>
    );
  };

  return (
    <div>
      {highlightTrial() && (
        <UpgradeBox
          featureId={'team-sync'}
          eventVariant={'trial'}
          featureName={'team sync'}
          text={t(
            'teams.team-group-sync.team-sync-upgrade',
            'Add a group to enable team sync for free during your trial of Grafana Pro'
          )}
        />
      )}
      <div className="page-action-bar">
        {(!highlightTrial() || groups.length > 0) && (
          <>
            <h3 className="page-sub-heading">
              <Trans i18nKey="teams.team-group-sync.external-group-sync">External group sync</Trans>
            </h3>
            <Tooltip placement="auto" content={headerTooltip}>
              <Icon className={cx(styles.icon, 'page-sub-heading-icon')} name="question-circle" />
            </Tooltip>
          </>
        )}
        <div className="page-action-bar__spacer" />
        {groups.length > 0 && (
          <Button onClick={onToggleAdding} icon="plus" disabled={isReadOnly}>
            <Trans i18nKey="teams.team-group-sync.add-group-button">Add group</Trans>
          </Button>
        )}
      </div>

      <SlideDown in={isAdding}>
        <div className="cta-form">
          <CloseButton onClick={onToggleAdding} />
          <form onSubmit={onAddGroup}>
            <InlineFieldRow>
              <InlineField
                label={t('teams.team-group-sync.label-add-external-group', 'Add external group')}
                tooltip={t('teams.team-group-sync.tooltip-add-external-group', 'LDAP group example: {{example}}', {
                  example: 'cn=users,ou=groups,dc=grafana,dc=org',
                })}
              >
                <Input
                  type="text"
                  id={'add-external-group'}
                  placeholder=""
                  value={newGroupId}
                  onChange={onNewGroupIdChanged}
                  disabled={isReadOnly}
                />
              </InlineField>
              <Button type="submit" disabled={isReadOnly || !isNewGroupValid()} style={{ marginLeft: 4 }}>
                <Trans i18nKey="teams.team-group-sync.add-group">Add group</Trans>
              </Button>
            </InlineFieldRow>
          </form>
        </div>
      </SlideDown>

      {groups.length === 0 &&
        !isAdding &&
        (highlightTrial() ? (
          <TeamSyncUpgradeContent
            action={{ onClick: onToggleAdding, text: t('teams.team-group-sync.text.add-group', 'Add group') }}
          />
        ) : (
          <EmptyListCTA
            onClick={onToggleAdding}
            buttonIcon="users-alt"
            title={t('teams.team-group-sync.title-there-external-groups', 'There are no external groups to sync with')}
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
                <th>
                  <Trans i18nKey="teams.team-group-sync.external-group-id">External Group ID</Trans>
                </th>
                <th style={{ width: '1%' }} />
              </tr>
            </thead>
            <tbody>{groups.map((group) => renderGroup(group))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const TeamSyncUpgradeContent = ({ action }: { action?: UpgradeContentProps['action'] }) => {
  const theme = useTheme2();
  return (
    <UpgradeContent
      action={action}
      listItems={[
        'Stop managing user access in two places - assign users to groups in SAML, LDAP or Oauth, and manage access at a Team level in Grafana',
        "Update users' permissions immediately when you add or remove them from an LDAP group, with no need for them to sign out and back in",
      ]}
      image={`team-sync-${theme.isLight ? 'light' : 'dark'}.png`}
      featureName={'team sync'}
      featureUrl={'https://grafana.com/docs/grafana/latest/enterprise/team-sync'}
      description={t(
        'teams.team-sync-upgrade-content.description',
        "Team Sync makes it easier for you to manage users' access in Grafana, by immediately updating each user's Grafana teams and permissions based on their single sign-on group membership, instead of when users sign in"
      )}
    />
  );
};
export default TeamGroupSync;

const getStyles = () => ({
  icon: css({
    opacity: 0.7,

    '&:hover': {
      opacity: 1,
    },
  }),
});
