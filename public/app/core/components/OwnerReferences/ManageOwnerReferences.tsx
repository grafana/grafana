/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { useState } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { Box, Button, Combobox, ComboboxOption, Divider, Stack, Text } from '@grafana/ui';
import { OwnerReference } from 'app/api/clients/folder/v1beta1';
import { useListTeamQuery, API_GROUP, API_VERSION } from 'app/api/clients/iam/v0alpha1';
import { useDispatch } from 'app/types/store';

import { TeamOwnerReference } from './OwnerReference';
import { SupportedResource, useAddOwnerReference, useGetOwnerReferences } from './hooks';

const TeamSelector = ({ onChange }: { onChange: (ownerRef: OwnerReference) => void }) => {
  const { data: teams } = useListTeamQuery({});
  const teamsOptions = teams?.items.map((team) => ({
    label: team.spec.title,
    value: team.metadata.name!,
  }));
  return (
    <Combobox
      options={teamsOptions}
      onChange={(team: ComboboxOption<string>) => {
        onChange({
          apiVersion: `${API_GROUP}/${API_VERSION}`,
          kind: 'Team',
          name: team.label,
          uid: team.value,
        });
      }}
    />
  );
};

export const ManageOwnerReferences = ({
  resource,
  resourceId,
}: {
  resource: SupportedResource;
  resourceId: string;
}) => {
  const dispatch = useDispatch();
  const [addingNewReference, setAddingNewReference] = useState(false);
  const [pendingReference, setPendingReference] = useState<OwnerReference | null>(null);
  const ownerReferences = useGetOwnerReferences({ resource, resourceId });
  const [trigger, result] = useAddOwnerReference({ resource, resourceId });

  const handleAddNewReference = () => {
    setAddingNewReference(true);
    reportInteraction('grafana_manage_dashboards_add_new_owner_clicked');
  };

  const handleSaveNewReference = () => {
    if (pendingReference) {
      trigger(pendingReference);
      reportInteraction('grafana_manage_dashboards_save_new_owner_clicked'); // TODO: add payload with number of teams?
    }
  };

  return (
    <Stack direction="column">
      <Text variant="h3">Owned by:</Text>
      <Box>
        {ownerReferences
          .filter((ownerReference) => ownerReference.kind === 'Team')
          .map((ownerReference) => (
            <>
              <TeamOwnerReference key={ownerReference.uid} ownerReference={ownerReference} pointOfUse="manageOwners" />
              <Divider />
            </>
          ))}
      </Box>
      <Box>
        {addingNewReference && (
          <Box paddingBottom={2}>
            <Text variant="h3">Add new owner reference:</Text>
            <TeamSelector
              onChange={(ownerReference) => {
                setPendingReference(ownerReference);
                // TODO: requires error handling if user doesn't choose a team
              }}
            />
            <Button onClick={handleSaveNewReference}>Save</Button>
            <Divider />
          </Box>
        )}
        <Button onClick={handleAddNewReference}>Add new owner reference</Button>
      </Box>
    </Stack>
  );
};
