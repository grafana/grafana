import { useEffect, useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Trans } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Stack } from '@grafana/ui';

import { ConnectionStatusBadge } from '../../Connection/ConnectionStatusBadge';
import { useInvalidateConnectionList } from '../../hooks/useConnectionList';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { type WizardFormData } from '../types';

interface ConnectionSelectProps {
  options: Array<ComboboxOption<string>>;
  isLoading: boolean;
  placeholder: string;
  required: string | false;
}

export function ConnectionSelect({ options, isLoading, placeholder, required }: ConnectionSelectProps) {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();
  const connectionName = watch('githubApp.connectionName');
  const { connection: selectedConnection, isConnected } = useConnectionStatus(connectionName);
  const invalidateConnectionList = useInvalidateConnectionList();

  // Refresh the connection list when the selected connection becomes ready,
  // so the options reflect its repositories without a manual reload.
  const wasConnected = useRef(isConnected);
  useEffect(() => {
    if (!wasConnected.current && isConnected) {
      invalidateConnectionList();
    }
    wasConnected.current = isConnected;
  }, [isConnected, invalidateConnectionList]);

  return (
    <Controller
      name="githubApp.connectionName"
      control={control}
      rules={{ required }}
      render={({ field: { onChange, value } }) => (
        <Stack direction="column" gap={1}>
          <Combobox
            options={options}
            onChange={(option) => onChange(option?.value ?? '')}
            value={value}
            invalid={Boolean(errors?.githubApp?.connectionName?.message)}
            loading={isLoading}
            disabled={isLoading}
            placeholder={placeholder}
          />

          {selectedConnection && (
            <Stack>
              <Trans i18nKey="provisioning.wizard.connection-status">Connection status:</Trans>
              <ConnectionStatusBadge status={selectedConnection.status} />
            </Stack>
          )}
        </Stack>
      )}
    />
  );
}
