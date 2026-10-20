import { css, cx } from '@emotion/css';
import { type FormEventHandler, useState } from 'react';

import {
  type TeamGroupDto,
  useAddTeamGroupApiMutation,
  useGetTeamGroupsApiQuery,
  useRemoveTeamGroupApiQueryMutation,
} from '@grafana/api-clients/internal/rtkq/legacy';
import { Trans, t } from '@grafana/i18n';
import { Input, Tooltip, Icon, Button, InlineField, InlineFieldRow, useStyles2 } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';

interface Props {
  isReadOnly: boolean;
  teamUid: string;
}

const headerTooltip = `Sync LDAP, OAuth or SAML groups with your Grafana teams.`;

const TeamGroupSync = ({ isReadOnly, teamUid }: Props) => {
  const [isAddBoxVisible, setIsAddBoxVisible] = useState(false);
  const [newGroupId, setNewGroupId] = useState('');
  const styles = useStyles2(getStyles);

  const { data: groups = [] } = useGetTeamGroupsApiQuery({ teamId: teamUid });
  const [addTeamGroup] = useAddTeamGroupApiMutation();
  const [removeTeamGroup] = useRemoveTeamGroupApiQueryMutation();

  const onToggleAdding = () => {
    setIsAddBoxVisible(!isAddBoxVisible);
  };

  const onNewGroupIdChanged: FormEventHandler<HTMLInputElement> = (event) => {
    setNewGroupId(event.currentTarget.value);
  };

  const onAddGroup: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    await addTeamGroup({ teamId: teamUid, teamGroupMapping: { groupId: newGroupId } });
    setIsAddBoxVisible(false);
    setNewGroupId('');
  };

  const onRemoveGroup = async (groupId: string | undefined) => {
    if (!groupId) {
      return;
    }
    await removeTeamGroup({ teamId: teamUid, groupId });
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
      <div className="page-action-bar">
        <h3 className="page-sub-heading">
          <Trans i18nKey="teams.team-group-sync.external-group-sync">External group sync</Trans>
        </h3>
        <Tooltip placement="auto" content={headerTooltip}>
          <Icon className={cx(styles.icon, 'page-sub-heading-icon')} name="question-circle" />
        </Tooltip>
        <div className="page-action-bar__spacer" />
        {groups.length > 0 && (
          <Button onClick={onToggleAdding} icon="plus" disabled={isReadOnly}>
            <Trans i18nKey="teams.team-group-sync.add-group-button">Add group</Trans>
          </Button>
        )}
      </div>

      <SlideDown in={isAddBoxVisible}>
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

      {groups.length === 0 && !isAddBoxVisible && (
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
      )}

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

export default TeamGroupSync;

const getStyles = () => ({
  icon: css({
    opacity: 0.7,

    '&:hover': {
      opacity: 1,
    },
  }),
});
