import { QueryStatus } from '@reduxjs/toolkit/query';
import { useEffect, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Box, Combobox, ComboboxOption, Label } from '@grafana/ui';
import { OwnerReference } from 'app/api/clients/folder/v1beta1';
import {
  API_GROUP as IAM_API_GROUP,
  API_VERSION as IAM_API_VERSION,
  useLazyGetTeamQuery,
  useLazyGetSearchTeamsQuery,
} from 'app/api/clients/iam/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

const OWNER_REFERENCE_API_VERSION = `${IAM_API_GROUP}/${IAM_API_VERSION}` as const;
const OWNER_REFERENCE_KIND = 'Team' as const;

/**
 * Component to allow selecting an owner to use as an owner reference.
 *
 * At this time, only supports a single team
 */
export const OwnerReferenceSelector = ({
  onChange,
  defaultTeamUid,
}: {
  onChange: (ownerRef: OwnerReference | null) => void;
  defaultTeamUid?: string;
}) => {
  const [selectedTeam, setSelectedTeam] = useState<ComboboxOption<string> | string | null>(defaultTeamUid || null);
  const [searchTeams, { isLoading }] = useLazyGetSearchTeamsQuery();
  const [getTeam, { isLoading: isSelectedTeamLoading, error: selectedTeamError }] = useLazyGetTeamQuery();

  useEffect(() => {
    if (defaultTeamUid) {
      getTeam({ name: defaultTeamUid }, true).then((query) => {
        if (query.status === QueryStatus.fulfilled) {
          setSelectedTeam({
            label: query.data.spec.title,
            value: query.data.metadata.name!,
          });
        }
        // We ignore errors here as we handle them with the useLazyGetTeamQuery call
      });
    }
  }, [defaultTeamUid, getTeam]);

  const loadOptions = async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
    const result = await searchTeams({ query: inputValue }, true).unwrap();

    const mappedResults = result.hits.map((team: { title: string; name: string }) => ({
      label: team.title,
      value: team.name,
    }));

    return mappedResults;
  };
  return (
    <Box>
      {Boolean(selectedTeamError) && (
        <Alert
          severity="error"
          title={t('manage-owner-references.error-load-team-details', 'Could not load team details')}
        >
          {extractErrorMessage(selectedTeamError)}
        </Alert>
      )}
      <Label htmlFor="owner-reference-selector">
        <Trans i18nKey="browse-dashboards.action.new-folder-as-team-folder-label">Team</Trans>
      </Label>

      <Combobox
        id="owner-reference-selector"
        isClearable
        prefixIcon="users-alt"
        value={selectedTeam}
        loading={isLoading || isSelectedTeamLoading}
        disabled={isLoading || isSelectedTeamLoading}
        options={loadOptions}
        placeholder={t('manage-owner-references.select-owner', 'Select an owner')}
        onChange={(team) => {
          setSelectedTeam(team);

          if (!team) {
            onChange(null);
            return;
          }

          onChange({
            apiVersion: OWNER_REFERENCE_API_VERSION,
            kind: OWNER_REFERENCE_KIND,
            name: team.value,
            uid: team.value,
          });
        }}
      />
    </Box>
  );
};
