import { useState } from 'react';

import { Combobox, ComboboxOption } from '@grafana/ui';
import { OwnerReference } from 'app/api/clients/folder/v1beta1';
import { useListTeamQuery, API_GROUP, API_VERSION } from 'app/api/clients/iam/v0alpha1';

/**
 * Component to allow selecting an owner to use as an owner reference.
 *
 * At this time, only supports a single team
 */
export const OwnerReferenceSelector = ({ onChange }: { onChange: (ownerRef: OwnerReference) => void }) => {
  const [selectedTeam, setSelectedTeam] = useState<ComboboxOption<string> | null>(null);
  const { data: teams, isLoading } = useListTeamQuery({});
  const teamsOptions = (teams?.items || []).map((team) => ({
    label: team.spec.title,
    value: team.metadata.name!,
  }));
  return (
    <Combobox
      loading={isLoading}
      options={teamsOptions}
      value={selectedTeam}
      onChange={(team: ComboboxOption<string>) => {
        setSelectedTeam(team);
        onChange({
          apiVersion: `${API_GROUP}/${API_VERSION}`,
          kind: 'Team',
          name: team.value,
          uid: team.value,
        });
      }}
    />
  );
};
