import { css } from '@emotion/css';
import { useState } from 'react';
import useMountedState from 'react-use/lib/useMountedState';

import { CreateTeamApiArg, useCreateTeamMutation, useSetTeamRolesMutation } from '@grafana/api-clients/rtkq/legacy';
import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Alert, AlertVariant, Icon, Link, Stack, Text, useStyles2 } from '@grafana/ui';
import { useCreateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { Role } from 'app/types/accessControl';

import { extractErrorMessage } from '../../api/utils';
import { contextSrv } from '../../core/services/context_srv';
import { TeamDTO } from '../../types/teams';

import { canUpdateRoles } from './hooks';

export interface CardProps {
  severity: AlertVariant;
  description: string;
  link?: ResultCardLink;
}

interface ResultCardLink {
  href: string;
  text: string;
}

/**
 * Alert that just shows the message and optional link. Link should point to some resource that the step successfully
 * created.
 * @param severity
 * @param description
 * @param link
 * @constructor
 */
export function StepResultAlert({ severity, description, link }: CardProps) {
  const styles = useStyles2(getStyles);

  return (
    <Alert severity={severity} title="">
      <Stack direction="row" justifyContent={'space-between'}>
        <Text>{description}</Text>
        {link && (
          <Link href={link.href} className={styles.link}>
            {link.text}
            <Icon name="external-link-alt" size="md" aria-hidden={true} className={styles.linkIcon} />
          </Link>
        )}
      </Stack>
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  link: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  linkIcon: css({
    flexShrink: 0,
  }),
});

/**
 * Each step is in one of these states.
 */
export type CallState =
  | {
      state: 'loading';
    }
  | {
      state: 'success';
      data?: string;
    }
  | {
      state: 'error';
      error: unknown;
    };

/**
 * The calls we are orchestrating here.
 */
type CallTypes = 'createTeam' | 'createRoles' | 'createFolder';

/**
 * Creates a reportState function which either saves the state of a step in the local state so it can be returned and
 * showed inline, or reports it through app events if the current component using this is unmounted.
 */
function useReportState() {
  const [teamCreationStatus, setTeamCreationStatus] = useState<CallState | undefined>(undefined);
  const [folderCreationStatus, setFolderCreationStatus] = useState<CallState | undefined>(undefined);
  const [rolesCreationStatus, setRolesCreationStatus] = useState<CallState | undefined>(undefined);

  const isMounted = useMountedState();

  function reportState(status: CallState, call: CallTypes) {
    if (isMounted()) {
      if (call === 'createTeam') {
        setTeamCreationStatus(status);
      }
      if (call === 'createFolder') {
        setFolderCreationStatus(status);
      }

      if (call === 'createRoles') {
        setRolesCreationStatus(status);
      }
      return;
    }

    const messages = getMessages()[call];

    // In this case the createTeam page was unmounted, user could have navigated somewhere, but we still are running
    // the teamCreation, hopefully. We don't have the inline status cards anymore, so let's just show toasts (yum)
    if (status.state === 'success') {
      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [messages.success],
      });
    } else if (status.state === 'error') {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [messages.error + (status.error ? ' ' + extractErrorMessage(status.error) : '')],
      });
    }
  }

  return { teamCreationStatus, folderCreationStatus, rolesCreationStatus, reportState };
}

/**
 * Hook that creates a trigger that will run all the necessary calls to create a team. It also reports back status,
 * either inline or using global app events depending on the mounted status of the component using it.
 * @param pendingRoles
 * @param autocreateTeamFolder
 */
export function useCreateTeamOrchestrate(pendingRoles: Role[], autocreateTeamFolder: boolean) {
  const [createTeamTrigger] = useCreateTeamMutation();
  const [createFolderTrigger] = useCreateFolder();
  const [setTeamRoles] = useSetTeamRolesMutation();

  const { teamCreationStatus, folderCreationStatus, rolesCreationStatus, reportState } = useReportState();

  // Trigger to create a team and optionally also roles and folder. Each one has its own state to inform user about the
  // progress or an error.
  const createTeam = async (formModel: TeamDTO) => {
    //////////////////////
    // Create a team first
    //////////////////////
    reportState({ state: 'loading' }, 'createTeam');
    const mutationArg: CreateTeamApiArg & { showSuccessAlert?: boolean } = {
      createTeamCommand: { email: formModel.email || '', name: formModel.name },
      // We are handling reporting here so don't need this, and createTeam just alerts all the time on success
      showSuccessAlert: false,
    };
    const { data: teamData, error: teamError } = await createTeamTrigger(mutationArg);

    // It shouldn't happen that we have success and no data, but the types are set up that way, so we check it here
    if (teamError || !teamData?.uid || !teamData?.teamId) {
      reportState({ state: 'error', error: teamError }, 'createTeam');
      return;
    }

    reportState({ state: 'success', data: teamData.uid }, 'createTeam');

    ////////////////////////////
    // Create roles if requested
    ////////////////////////////
    if (pendingRoles && pendingRoles.length) {
      // TODO: this fetch can fail or user just don't have permissions and this is skipped silently
      //  Maybe we should just do that in the form itself and disable the input if user does not have permissions
      await contextSrv.fetchUserPermissions();
      if (contextSrv.licensedAccessControlEnabled() && canUpdateRoles()) {
        reportState({ state: 'loading' }, 'createRoles');

        const { error: roleError } = await setTeamRoles({
          teamId: teamData.teamId,
          setTeamRolesCommand: {
            roleUids: pendingRoles.map((role) => role.uid),
          },
        });
        if (roleError) {
          reportState({ state: 'error', error: roleError }, 'createRoles');
        } else {
          reportState({ state: 'success' }, 'createRoles');
        }
      }
    }

    ///////////////////////////////
    // Create a folder if requested
    ///////////////////////////////
    if (autocreateTeamFolder) {
      reportState({ state: 'loading' }, 'createFolder');
      const { data: folderData, error: folderError } = await createFolderTrigger({
        title: formModel.name,
        teamOwnerReferences: [{ uid: teamData.uid, name: formModel.name }],
      });

      if (folderError || !folderData?.url) {
        reportState({ state: 'error', error: folderError }, 'createFolder');
        return;
      }
      reportState({ state: 'success', data: folderData.url }, 'createFolder');
    }
  };

  return { teamCreationStatus, folderCreationStatus, rolesCreationStatus, trigger: createTeam };
}

/**
 * Based on the status of the API call step, generate appropriate props for the alert.
 * @param status
 * @param type
 * @param href
 */
export function getStatusCardProps(status: CallState, type: CallTypes, href?: string): CardProps {
  const messages = getMessages()[type];
  if (status.state === 'error') {
    return {
      severity: 'error',
      description: messages.error + (status.error ? ' ' + extractErrorMessage(status.error) : ''),
    };
  }

  if (status.state === 'success') {
    return {
      severity: 'success',
      description: messages.success,
      link:
        href && 'link' in messages
          ? {
              href,
              text: messages.link,
            }
          : undefined,
    };
  }

  // We don't report on anything else than an error
  return {
    severity: 'info',
    description: messages.loading,
  };
}

function getMessages() {
  return {
    createTeam: {
      success: t('teams.create-team.team-creation-success', 'Team created successfully.'),
      error: t('teams.create-team.failed-to-create', 'Failed to create team:'),
      loading: t('teams.create-team.team-creation-loading', 'Creating team...'),
      link: t('teams.create-team.team-creation-link', 'Open team details'),
    },
    createFolder: {
      success: t('teams.create-team.folder-creation-success', 'Folder created successfully.'),
      error: t('teams.create-team.folder-create-failed', 'Failed to create folder:'),
      loading: t('teams.create-team.folder-creation-loading', 'Creating folder...'),
      link: t('teams.create-team.folder-creation-link', 'Open folder'),
    },
    createRoles: {
      success: t('teams.create-team.role-creation-success', 'Roles created successfully.'),
      error: t('teams.create-team.roles-create-failed', 'Failed to create roles:'),
      loading: t('teams.create-team.roles-creation-loading', 'Creating roles...'),
    },
  };
}
