import { useState, useCallback, useMemo } from 'react';

import { Stack, Alert, Button } from '@grafana/ui';
import { useListTeamRolesQuery } from 'app/api/clients/roles';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { Team } from 'app/types/teams';

import { AddTeamRoleModal } from './AddTeamRoleModal';
import { TeamRolesTable } from './TeamRolesTable';

interface Props {
  team: Team;
}

export default function TeamRolesPage({ team }: Props) {
  const isEnterprise = contextSrv.licensedAccessControlEnabled();
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);

  const canAddRoles = contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesAdd);

  // Fetch team roles
  const { data: roles = [], isLoading, refetch } = useListTeamRolesQuery({
    teamId: team.id,
    includeHidden: false,
  });

  // Get current role UIDs (directly assigned only, excluding mapped roles)
  const currentRoleUids = useMemo(() => {
    return roles.filter((role) => !role.mapped).map((role) => role.uid);
  }, [roles]);

  const handleRolesChanged = useCallback(() => {
    refetch();
  }, [refetch]);

  // Show enterprise feature notice in OSS mode
  if (!isEnterprise) {
    return (
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      <Alert severity="info" title="Enterprise Feature">
        Role management requires Grafana Enterprise with RBAC enabled. Contact your administrator or visit
        grafana.com to learn more about Grafana Enterprise.
      </Alert>
    );
  }

  return (
    <Stack gap={1} direction="column">
      {!isLoading && (
        <>
          <TeamRolesTable roles={roles} teamId={team.id} onRolesChanged={handleRolesChanged} />

          {canAddRoles && (
            <>
              <div>
                {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                <Button variant="primary" icon="plus" onClick={() => setIsAddRoleModalOpen(true)}>
                  Add Role
                </Button>
              </div>
              <AddTeamRoleModal
                isOpen={isAddRoleModalOpen}
                teamId={team.id}
                currentRoleUids={currentRoleUids}
                onDismiss={() => setIsAddRoleModalOpen(false)}
                onRoleAdded={() => {
                  setIsAddRoleModalOpen(false);
                  handleRolesChanged();
                }}
              />
            </>
          )}
        </>
      )}
    </Stack>
  );
}
