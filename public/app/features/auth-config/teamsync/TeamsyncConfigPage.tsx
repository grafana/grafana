import React, { useCallback, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { NavModelItem } from '@grafana/data';
import { Button, InlineField, InlineFieldRow, Input } from '@grafana/ui';
import { CloseButton } from '@grafana/ui/src/components/uPlot/plugins/CloseButton';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import { TeamPicker } from 'app/core/components/Select/TeamPicker';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { TeamSyncUpgradeContent } from 'app/features/teams/TeamGroupSync';

import { StoreState } from '../../../types';
import { loadProviders } from '../state/actions';

export interface TeamGroup {
  groupId: string;
  teamIds: number[];
}

const pageNav: NavModelItem = {
  text: 'External Group Sync',
  subTitle: 'Map groups from your idP to Grafana teams.',
  icon: 'users-alt',
  id: 'teamsync',
};

interface RouteProps extends GrafanaRouteComponentProps<{ provider: string }> {}

function mapStateToProps(state: StoreState, props: RouteProps) {
  const { isLoading, providers } = state.authConfig;
  const { provider } = props.match.params;
  const config = providers.find((config) => config.provider === provider);
  return {
    config,
    isLoading,
    provider,
  };
}

const headerTooltip = `Sync LDAP, OAuth or SAML groups with your Grafana teams.`;

const mapDispatchToProps = {
  loadProviders,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export type Props = ConnectedProps<typeof connector>;

/**
 * Separate the Page logic from the Content logic for easier testing.
 */
export const TeamsyncConfigPage = ({}: Props) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newGroupId, setNewGroupId] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [teamId, setTeamId] = useState(0);
  const exampleMap: Map<number, string> = new Map([
    [1, 'Team 1'],
    [2, 'Team 2'],
  ]);

  const onToggleAdding = useCallback(() => setIsAdding(!isAdding), [isAdding]);
  const onAddGroup = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      // Add group logic here
    },
    [newGroupId]
  );

  const groups: TeamGroup[] = [
    { teamIds: [1, 2], groupId: 'group1' },
    { teamIds: [2], groupId: 'group2' },
  ];

  function renderGroup(group: TeamGroup) {
    const onDelete = () => {
      // Delete group logic here
    };

    return (
      <tr key={group.groupId}>
        <td>{group.groupId}</td>
        <td>
          {group.teamIds.map((id, index) => (
            <a key={index} href={`/org/teams/edit/${id}`} style={{ marginRight: '10px', textDecoration: 'underline' }}>
              {exampleMap.get(id)}
            </a>
          ))}
        </td>
        <td>
          <Button onClick={onDelete} variant="destructive">
            Delete
          </Button>
        </td>
      </tr>
    );
  }

  function onNewGroupIdChanged(value: any): void {
    setNewGroupId(value.target.value);
  }

  return (
    <Page navId="authentication" pageNav={pageNav}>
      <div>
        {groups.length === 0 &&
          !isAdding &&
          (false ? (
            <TeamSyncUpgradeContent action={{ onClick: onToggleAdding, text: 'Add group' }} />
          ) : (
            <EmptyListCTA
              onClick={onToggleAdding}
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
                  <th>Teams</th>
                  <th style={{ width: '1%' }} />
                </tr>
              </thead>
              <tbody>{groups.map((group) => renderGroup(group))}</tbody>
            </table>
          </div>
        )}

        <Button
          variant={'primary'}
          key="add-permission"
          style={{ marginBottom: 10 }}
          onClick={onToggleAdding}
          icon="plus"
        >
          Add new Group Mapping
        </Button>
        <SlideDown in={isAdding}>
          <div className="cta-form">
            <CloseButton onClick={onToggleAdding} />
            <form onSubmit={onAddGroup}>
              <InlineFieldRow>
                <InlineField
                  label={'Add new group mapping'}
                  tooltip="LDAP Group Example: cn=users,ou=groups,dc=grafana,dc=org."
                >
                  <Input
                    type="text"
                    id={'add-external-group'}
                    placeholder=""
                    onChange={onNewGroupIdChanged}
                    value={newGroupId}
                    disabled={isReadOnly}
                  />
                </InlineField>
                <InlineField>
                  <TeamPicker onSelected={(t) => setTeamId(t.value?.id || 0)} />
                </InlineField>
                <Button type="submit" disabled={isReadOnly} style={{ marginLeft: 4 }}>
                  Save
                </Button>
              </InlineFieldRow>
            </form>
          </div>
        </SlideDown>
      </div>
    </Page>
  );
};

export default connector(TeamsyncConfigPage);
