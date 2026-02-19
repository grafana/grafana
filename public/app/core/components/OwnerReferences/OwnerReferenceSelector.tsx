import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Box, Combobox, ComboboxOption, Label } from '@grafana/ui';
import { OwnerReference } from 'app/api/clients/folder/v1beta1';
import {
  useListTeamQuery,
  API_GROUP as IAM_API_GROUP,
  API_VERSION as IAM_API_VERSION,
} from 'app/api/clients/iam/v0alpha1';

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
  const { data: teams, isLoading } = useListTeamQuery({});
  const teamsOptions = (teams?.items || []).map((team) => ({
    label: team.spec.title,
    value: team.metadata.name!,
  }));
  return (
    <Box>
      <Label htmlFor="owner-reference-selector">
        <Trans i18nKey="browse-dashboards.action.new-folder-as-team-folder-label">Team</Trans>
      </Label>

      <Combobox
        id="owner-reference-selector"
        isClearable
        value={selectedTeam}
        loading={isLoading}
        options={teamsOptions}
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
