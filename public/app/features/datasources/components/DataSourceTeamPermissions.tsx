import { useState, useEffect } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import { type Team } from 'app/types/teams';

export interface TeamAccessRule {
  teamId: number;
  permission: 'Admin' | 'Member';
}

interface Props {
  allowedTeams: string;
  onChange: (allowedTeams: string) => void;
}

export const DataSourceTeamPermissions = ({ allowedTeams, onChange }: Props) => {
  const [teamRules, setTeamRules] = useState<TeamAccessRule[]>([]);
  const [availableTeams, setAvailableTeams] = useState<SelectableValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (allowedTeams) {
      const parsed = parseAllowedTeams(allowedTeams);
      setTeamRules(parsed);
    }
  }, [allowedTeams]);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    setIsLoading(true);
    try {
      const result = await getBackendSrv().get<{ teams: Team[] }>('/api/teams/search?perpage=100&page=1');
      const teams = result.teams.map((team) => ({
        value: team.id,
        label: team.name,
        imgUrl: team.avatarUrl,
      }));
      setAvailableTeams(teams);
    } finally {
      setIsLoading(false);
    }
  };

  const parseAllowedTeams = (value: string): TeamAccessRule[] => {
    if (!value) return [];
    const rules: TeamAccessRule[] = [];
    const entries = value.split(',');
    for (const entry of entries) {
      const parts = entry.trim().split(':');
      if (parts.length === 2) {
        const teamId = parseInt(parts[0], 10);
        const permission = parts[1] as 'Admin' | 'Member';
        if (!isNaN(teamId) && (permission === 'Admin' || permission === 'Member')) {
          rules.push({ teamId, permission });
        }
      }
    }
    return rules;
  };

  const serializeAllowedTeams = (rules: TeamAccessRule[]): string => {
    return rules.map((r) => `${r.teamId}:${r.permission}`).join(',');
  };

  const handleAddTeam = (teamId: number, permission: 'Admin' | 'Member') => {
    const newRules = [...teamRules, { teamId, permission }];
    setTeamRules(newRules);
    onChange(serializeAllowedTeams(newRules));
  };

  const handleRemoveTeam = (index: number) => {
    const newRules = teamRules.filter((_, i) => i !== index);
    setTeamRules(newRules);
    onChange(serializeAllowedTeams(newRules));
  };

  const handleUpdatePermission = (index: number, permission: 'Admin' | 'Member') => {
    const newRules = [...teamRules];
    newRules[index] = { ...newRules[index], permission };
    setTeamRules(newRules);
    onChange(serializeAllowedTeams(newRules));
  };

  const usedTeamIds = teamRules.map((r) => r.teamId);
  const availableForSelection = availableTeams.filter((t) => !usedTeamIds.includes(t.value as number));

  const permissionOptions = [
    { value: 'Admin', label: t('datasources.teamPermissions.admin', 'Admin') },
    { value: 'Member', label: t('datasources.teamPermissions.member', 'Member') },
  ];

  return (
    <div className="gf-form-group">
      <h3>{t('datasources.teamPermissions.title', 'Team Access')}</h3>
      <p className="muted-text" style={{ marginBottom: '1rem' }}>
        {t(
          'datasources.teamPermissions.description',
          'Restrict access to users based on their team membership and permission level.'
        )}
      </p>

      {teamRules.length === 0 && (
        <p className="muted-text">{t('datasources.teamPermissions.noRestrictions', 'No team restrictions applied. All users can access this datasource.')}</p>
      )}

      {teamRules.map((rule, index) => {
        const team = availableTeams.find((t) => t.value === rule.teamId);
        return (
          <InlineFieldRow key={`${rule.teamId}-${index}`} style={{ marginBottom: '4px' }}>
            <InlineField label={team?.label || `Team ${rule.teamId}`} />
            <Select
              value={{ value: rule.permission, label: rule.permission }}
              options={permissionOptions}
              onChange={(option) => handleUpdatePermission(index, option.value as 'Admin' | 'Member')}
              width={15}
            />
            <button
              type="button"
              className="btn btn-danger btn-small"
              onClick={() => handleRemoveTeam(index)}
              style={{ marginLeft: '8px' }}
            >
              {t('datasources.teamPermissions.remove', 'Remove')}
            </button>
          </InlineFieldRow>
        );
      })}

      <InlineFieldRow style={{ marginTop: '8px' }}>
        <Select
          isLoading={isLoading}
          options={availableForSelection}
          onChange={(option) => {
            if (option.value) {
              handleAddTeam(option.value as number, 'Member');
            }
          }}
          placeholder={t('datasources.teamPermissions.selectTeam', 'Select a team')}
          width={20}
          isClearable={false}
        />
      </InlineFieldRow>
    </div>
  );
};