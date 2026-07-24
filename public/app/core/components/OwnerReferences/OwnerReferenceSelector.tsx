import { QueryStatus } from '@reduxjs/toolkit/query';
import { useEffect, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Box, type ComboboxOption, Label, MultiCombobox } from '@grafana/ui';
import { type OwnerReference } from 'app/api/clients/folder/v1beta1';
import { API_GROUP as IAM_API_GROUP, API_VERSION as IAM_API_VERSION } from 'app/api/clients/iam/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';
import { useLazyGetTeamByUidQuery, useLazySearchTeamsQuery } from 'app/features/teams/hooks';

const OWNER_REFERENCE_API_VERSION = `${IAM_API_GROUP}/${IAM_API_VERSION}` as const;
const OWNER_REFERENCE_KIND = 'Team' as const;

function toOwnerReference(teamUid: string): OwnerReference {
  return {
    apiVersion: OWNER_REFERENCE_API_VERSION,
    kind: OWNER_REFERENCE_KIND,
    name: teamUid,
    uid: teamUid,
  };
}

/**
 * Component to select one or more teams to use as owner references.
 *
 * A folder can be owned by multiple teams; each selected team becomes an owner reference.
 */
export const OwnerReferenceSelector = ({
  onChange,
  defaultTeamUids,
}: {
  onChange: (ownerRefs: OwnerReference[]) => void;
  defaultTeamUids?: string[];
}) => {
  const [selectedTeams, setSelectedTeams] = useState<Array<ComboboxOption<string>>>([]);
  const [searchTeams, { isLoading }] = useLazySearchTeamsQuery();
  const [getTeam, { isLoading: isSelectedTeamLoading, error: selectedTeamError }] = useLazyGetTeamByUidQuery();

  useEffect(() => {
    if (!defaultTeamUids?.length) {
      return;
    }

    let cancelled = false;
    // Resolve each seeded team UID to a display label. Unresolved teams (deleted or
    // forbidden) are still shown by UID so the owner isn't silently dropped on save.
    Promise.all(
      defaultTeamUids.map((uid) =>
        getTeam({ name: uid }, true).then(({ data, status }) => {
          if (status === QueryStatus.fulfilled && data) {
            return { label: data.spec.title, value: data.metadata.name! };
          }
          return { label: t('manage-owner-references.team-not-found', '[Unknown team]'), value: uid };
        })
      )
    ).then((options) => {
      if (!cancelled) {
        setSelectedTeams(options);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [defaultTeamUids, getTeam]);

  const loadOptions = async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
    const { data } = await searchTeams({ query: inputValue }, true);

    return (data?.hits ?? []).map((team: { title: string; name: string }) => ({
      label: team.title,
      value: team.name,
    }));
  };

  const teamIsMissingOrForbidden = isFetchError(selectedTeamError) && [404, 403].includes(selectedTeamError.status);
  const errorLevel = teamIsMissingOrForbidden ? 'warning' : 'error';
  const teamErrorMessage = teamIsMissingOrForbidden ? (
    <Trans i18nKey="manage-owner-references.selected-team-not-found">
      Selected team not found, or you do not have the necessary permissions to view it.
    </Trans>
  ) : (
    extractErrorMessage(selectedTeamError)
  );
  return (
    <Box>
      {Boolean(selectedTeamError) && (
        <Alert
          severity={errorLevel}
          title={t('manage-owner-references.error-load-team-details', 'Could not load team details')}
        >
          {teamErrorMessage}
        </Alert>
      )}
      <Label htmlFor="owner-reference-selector">
        <Trans i18nKey="browse-dashboards.action.new-folder-as-team-folder-label">Teams</Trans>
      </Label>

      <MultiCombobox<string>
        id="owner-reference-selector"
        isClearable
        prefixIcon="users-alt"
        value={selectedTeams}
        loading={isLoading || isSelectedTeamLoading}
        options={loadOptions}
        placeholder={t('manage-owner-references.select-owners', 'Select owners')}
        onChange={(teams) => {
          setSelectedTeams(teams);
          onChange(teams.map((team) => toOwnerReference(team.value)));
        }}
      />
    </Box>
  );
};
