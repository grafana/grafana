import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Button, Drawer } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { t, Trans } from 'app/core/internationalization';
import { BMCRole, StoreState } from 'app/types';

import { TeamsActionBar } from './TeamsActionBar';
import { TeamsTable } from './TeamsTable';
import { checkStatusChanged, clearState, loadTeams, postTeams, selectAllStatusChanged } from './state/actions';
import { getTeamsSearchQuery } from './state/selectors';

function mapStateToProps(state: StoreState) {
  const searchQuery = getTeamsSearchQuery(state.rbacTeams);
  return {
    teams: state.rbacTeams.teams,
    searchQuery: searchQuery,
    selectedCount: state.rbacTeams.selectedCount,
    perPage: state.rbacTeams.perPage,
    isLoading: state.rbacTeams.isLoading,
    teamsAdded: state.rbacTeams.teamsAdded,
    teamsRemoved: state.rbacTeams.teamsRemoved,
  };
}

const mapDispatchToProps = {
  loadTeams,
  checkStatusChanged,
  selectAllStatusChanged,
  clearState,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = { role: BMCRole; onDismiss: () => void } & ConnectedProps<typeof connector>;

export const TeamsListPageContent = ({
  teams,
  selectedCount,
  isLoading,
  teamsAdded,
  teamsRemoved,
  loadTeams,
  checkStatusChanged,
  selectAllStatusChanged,
  clearState,
  role,
  onDismiss,
}: Props): JSX.Element => {
  useEffect(() => {
    loadTeams(role.id!);
  }, [loadTeams, role.id]);

  // const pageRef = React.useRef<HTMLDivElement>(null);
  // const actionBarRef = React.useRef<HTMLDivElement>(null);
  // const actionBtnRef = React.useRef<HTMLDivElement>(null);

  const [submitted, setSubmitted] = useState<boolean>(false);

  const renderTable = () => {
    return teams?.length ? (
      <TeamsTable
        teams={teams}
        roleId={role.id!}
        onTeamCheckboxChange={checkStatusChanged}
        onSelectAllChange={selectAllStatusChanged}
      />
    ) : (
      <div
        className={css`
          text-align: center;
        `}
      >
        <Trans i18nKey="bmc.rbac.teams.none-found">No teams found</Trans>
      </div>
    );
  };

  const submitTeams = () => {
    setSubmitted(true);
    postTeams(role.id!, teamsAdded, teamsRemoved)
      .then((resp) => {
        clearState();
        onDismiss();
      })
      // TODO: catch errors
      .finally(() => {
        setSubmitted(false);
      });
  };

  const onClose = () => {
    clearState();
    onDismiss();
  };

  return (
    <>
      <TeamsActionBar roleId={role.id!} selectedCount={selectedCount} />
      <Page.Contents isLoading={isLoading}>
        {!isLoading && renderTable()}
        {teams?.length ? (
          <div
            className={css`
              display: flex;
              justify-content: end;
              margin-top: 15px;
            `}
          >
            <Button
              size="md"
              style={{ marginRight: '15px' }}
              variant={'primary'}
              fill="solid"
              icon={submitted ? 'fa fa-spinner' : undefined}
              onClick={submitTeams}
              disabled={submitted || (!teamsAdded.length && !teamsRemoved.length)}
            >
              {' '}
              <Trans i18nKey="bmc.common.save">Save</Trans>
            </Button>
            <Button size="md" variant="secondary" fill="solid" onClick={onClose}>
              {' '}
              <Trans i18nKey="bmc.common.cancel">Cancel</Trans>
            </Button>
          </div>
        ) : (
          <></>
        )}
      </Page.Contents>
    </>
  );
};

const TeamListDrawerUnconnected = (props: Props) => {
  const selectedCountText =
    props.selectedCount === 0
      ? t('bmc.rbac.teams.none-assigned', 'No teams assigned')
      : props.selectedCount
        ? `${props.selectedCount} ${props.selectedCount > 1 ? t('bmc.rbac.teams.title', 'Teams').toLowerCase() : t('bmc.rbac.teams.team', 'team')} ${t('bmc.rbac.common.assigned', 'Assigned').toLowerCase()}`
        : t('bmc.common.loading', 'Loading...');

  return (
    <Drawer
      title={`${props.role.name} - ${t('bmc.rbac.teams.title', 'Teams')}`}
      onClose={() => {
        props.clearState();
        props.onDismiss();
      }}
      closeOnMaskClick={false}
      width={'40%'}
      subtitle={selectedCountText}
      expandable
      scrollableContent
    >
      <TeamsListPageContent {...props} />
    </Drawer>
  );
};

export const TeamListDrawer = connector(TeamListDrawerUnconnected);
