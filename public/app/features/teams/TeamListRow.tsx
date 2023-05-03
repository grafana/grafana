import React from 'react';

import { DeleteButton } from '@grafana/ui';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role, Team } from 'app/types';

type Props = {
  team: Team;
  roleOptions: Role[];
  isTeamAdmin: boolean;
  displayRolePicker: boolean;
  onDelete: (id: number) => void;
};

export const TeamListRow = ({ team, roleOptions, isTeamAdmin, displayRolePicker, onDelete }: Props) => {
  const teamUrl = `org/teams/edit/${team.id}`;
  const canDelete = contextSrv.hasAccessInMetadata(AccessControlAction.ActionTeamsDelete, team, isTeamAdmin);
  const canReadTeam = contextSrv.hasAccessInMetadata(AccessControlAction.ActionTeamsRead, team, isTeamAdmin);
  const canSeeTeamRoles = contextSrv.hasAccessInMetadata(AccessControlAction.ActionTeamsRolesList, team, false);

  return (
    <tr key={team.id}>
      <td className="width-4 text-center link-td">
        {canReadTeam ? (
          <a href={teamUrl}>
            <img className="filter-table__avatar" src={team.avatarUrl} alt="Team avatar" />
          </a>
        ) : (
          <img className="filter-table__avatar" src={team.avatarUrl} alt="Team avatar" />
        )}
      </td>
      <td className="link-td">
        {canReadTeam ? <a href={teamUrl}>{team.name}</a> : <div style={{ padding: '0px 8px' }}>{team.name}</div>}
      </td>
      <td className="link-td">
        {canReadTeam ? (
          <a href={teamUrl} aria-label={team.email || 'Empty email cell'}>
            {team.email}
          </a>
        ) : (
          <div style={{ padding: '0px 8px' }} aria-label={team.email || 'Empty email cell'}>
            {team.email}
          </div>
        )}
      </td>
      <td className="link-td">
        {canReadTeam ? (
          <a href={teamUrl}>{team.memberCount}</a>
        ) : (
          <div style={{ padding: '0px 8px' }}>{team.memberCount}</div>
        )}
      </td>
      {displayRolePicker && <td>{canSeeTeamRoles && <TeamRolePicker teamId={team.id} roleOptions={roleOptions} />}</td>}
      <td className="text-right">
        <DeleteButton
          aria-label={`Delete team ${team.name}`}
          size="sm"
          disabled={!canDelete}
          onConfirm={() => onDelete(team.id)}
        />
      </td>
    </tr>
  );
};
