import { useFormContext } from 'react-hook-form';

import { Stack } from '@grafana/ui';

import { SourceFields } from '../Config/SourceFields';

import { type WizardFormData } from './types';

export function SourceConnectStep() {
  const { control } = useFormContext<WizardFormData>();

  return (
    <Stack direction="column" gap={2}>
      <SourceFields
        control={control}
        names={{
          url: 'repository.source.url',
          authType: 'repository.source.auth.type',
          token: 'repository.token',
          connectionName: 'repository.connectionName',
          allow: 'repository.source.allow',
          emptyTreePolicy: 'repository.source.emptyTreePolicy',
          caBundle: 'repository.source.tls.caBundle',
          serverName: 'repository.source.tls.serverName',
        }}
      />
    </Stack>
  );
}
