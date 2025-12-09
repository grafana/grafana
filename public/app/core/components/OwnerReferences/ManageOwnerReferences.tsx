/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { useState } from 'react';

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

  const addOwnerReference = (ownerReference: OwnerReference) => {
    trigger(ownerReference);
  };

  return (
    <Stack direction="column">
      <Text variant="h3">Owned by:</Text>
      <Box>
        {ownerReferences
          .filter((ownerReference) => ownerReference.kind === 'Team')
          .map((ownerReference) => (
            <>
              <TeamOwnerReference key={ownerReference.uid} ownerReference={ownerReference} />
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
              }}
            />
            <Button
              onClick={() => {
                addOwnerReference(pendingReference);
              }}
            >
              Save
            </Button>
            <Divider />
          </Box>
        )}
        <Button onClick={() => setAddingNewReference(true)}>Add new owner reference</Button>
      </Box>
    </Stack>
  );
};
