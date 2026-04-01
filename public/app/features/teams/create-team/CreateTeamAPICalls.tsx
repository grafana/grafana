import memoizeOne from 'memoize-one';
import { useState } from 'react';
import useMountedState from 'react-use/lib/useMountedState';

import {
  type CreateTeamApiArg,
  type SetTeamRolesApiArg,
  useCreateTeamMutation,
  useSetTeamRolesMutation,
} from '@grafana/api-clients/internal/rtkq/legacy';
import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getAppEvents } from '@grafana/runtime';

import { useCreateFolder } from '../../../api/clients/folder/v1beta1/hooks';
import { extractErrorMessage } from '../../../api/utils';
import { contextSrv } from '../../../core/services/context_srv';
import { type Role } from '../../../types/accessControl';
import { type TeamDTO } from '../../../types/teams';
import { canUpdateRoles } from '../hooks';

import { type StepResultAlertProps } from './StepResultAlert';

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

type CreateTeamResult = {
  teamCreationStatus: CallState | undefined;
  rolesCreationStatus: CallState | undefined;
  folderCreationStatus: CallState | undefined;
};

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
  const createTeam = async (formModel: TeamDTO): Promise<CreateTeamResult> => {
    let teamCreationStatus: CallState | undefined = undefined;
    let rolesCreationStatus: CallState | undefined = undefined;
    let folderCreationStatus: CallState | undefined = undefined;

    // It looks weird that we update the status also here when we already have the react state variables. The thing is
    // this function can run even when the original component is unmounted, and even if it wasn't, we cannot close
    // around those variables if they are recreated outside of the function as the closed around pointer won't change.
    // So if you want to return the correct state value from this function (for example, for reporting purposes), we
    // need to also keep track of the state inline.
    function localUpdateState(state: CallState, call: CallTypes) {
      reportState(state, call);
      switch (call) {
        case 'createTeam':
          teamCreationStatus = state;
          break;
        case 'createRoles':
          rolesCreationStatus = state;
          break;
        case 'createFolder':
          folderCreationStatus = state;
          break;
      }
    }

    //
    // Create a team first
    //
    localUpdateState({ state: 'loading' }, 'createTeam');
    const mutationArg: CreateTeamApiArg & { showSuccessAlert?: boolean } = {
      createTeamCommand: { email: formModel.email || '', name: formModel.name },
      // We are handling reporting here so don't need this, and createTeam just alerts all the time on success
      showSuccessAlert: false,
    };
    const { data: teamData, error: teamError } = await createTeamTrigger(mutationArg);

    // It shouldn't happen that we have success and no data, but the types are set up that way, so we check it here
    if (teamError || !teamData?.uid || !teamData?.teamId) {
      localUpdateState({ state: 'error', error: teamError }, 'createTeam');
      return { teamCreationStatus, folderCreationStatus, rolesCreationStatus };
    }

    localUpdateState({ state: 'success', data: teamData.uid }, 'createTeam');

    //
    // Create roles if requested
    //
    if (pendingRoles && pendingRoles.length) {
      localUpdateState({ state: 'loading' }, 'createRoles');
      // TODO: this fetch can fail or user just don't have permissions and this is skipped silently
      //  Maybe we should just do that in the form itself and disable the input if user does not have permissions
      await contextSrv.fetchUserPermissions();
      if (contextSrv.licensedAccessControlEnabled() && canUpdateRoles()) {
        const mutationArg: SetTeamRolesApiArg & { showSuccessAlert?: boolean } = {
          teamId: teamData.teamId,
          setTeamRolesCommand: {
            roleUids: pendingRoles.map((role) => role.uid),
          },
          // We are handling reporting here so don't need this, and createTeam just alerts all the time on success
          showSuccessAlert: false,
        };
        const { error: roleError } = await setTeamRoles(mutationArg);

        if (roleError) {
          localUpdateState({ state: 'error', error: roleError }, 'createRoles');
        } else {
          localUpdateState({ state: 'success' }, 'createRoles');
        }
      } else {
        // Probably should not happen as this should be checked before creating a team.
        localUpdateState(
          {
            state: 'error',
            error: new Error(
              t('teams.create-team.roles-create-permission-issue', "You don't have permissions to set roles")
            ),
          },
          'createRoles'
        );
      }
    }

    //
    // Create a folder if requested
    //
    if (autocreateTeamFolder && config.featureToggles.teamFolders) {
      localUpdateState({ state: 'loading' }, 'createFolder');
      const { data: folderData, error: folderError } = await createFolderTrigger({
        title: formModel.name,
        teamOwnerReferences: [{ uid: teamData.uid, name: teamData.uid }],
      });

      if (folderError || !folderData?.url) {
        localUpdateState({ state: 'error', error: folderError }, 'createFolder');
      } else {
        localUpdateState({ state: 'success', data: folderData.url }, 'createFolder');
      }
    }

    return { teamCreationStatus, folderCreationStatus, rolesCreationStatus };
  };

  return { teamCreationStatus, folderCreationStatus, rolesCreationStatus, trigger: createTeam };
}

/**
 * Based on the status of the API call step, generate appropriate props for the alert.
 * @param status
 * @param type
 * @param href
 */
export function getStatusCardProps(status: CallState, type: CallTypes, href?: string): StepResultAlertProps {
  const messages = getMessages()[type];
  if (status.state === 'error') {
    return {
      severity: 'error',
      description: messages.error + (status.error ? ' ' + extractErrorMessage(status.error) : ''),
      help: 'help' in messages ? messages.help : undefined,
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

const getMessages = memoizeOne(() => {
  return {
    createTeam: {
      success: t('teams.create-team.team-creation-success', 'Team created successfully.'),
      error: t('teams.create-team.failed-to-create', 'Failed to create team: '),
      loading: t('teams.create-team.team-creation-loading', 'Creating team...'),
      link: t('teams.create-team.team-creation-link', 'Open team details'),
    },
    createFolder: {
      success: t('teams.create-team.folder-creation-success', 'Folder created successfully.'),
      error: t('teams.create-team.folder-create-failed', 'Failed to create folder: '),
      help: t(
        'teams.create-team.folder-create-failed-help',
        'You can create the folder and assign it to a team manually from dashboards browser.'
      ),
      loading: t('teams.create-team.folder-creation-loading', 'Creating folder...'),
      link: t('teams.create-team.folder-creation-link', 'Open folder'),
    },
    createRoles: {
      success: t('teams.create-team.role-creation-success', 'Roles created successfully.'),
      error: t('teams.create-team.roles-create-failed', 'Failed to create roles: '),
      loading: t('teams.create-team.roles-creation-loading', 'Creating roles...'),
    },
  };
});
