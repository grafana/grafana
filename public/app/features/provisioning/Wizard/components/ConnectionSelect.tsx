import { Controller, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { type ComboboxOption, Combobox, Stack } from '@grafana/ui';

import { ConnectionStatusBadge } from '../../Connection/ConnectionStatusBadge';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { type WizardFormData } from '../types';

interface ConnectionSelectProps {
  options: Array<ComboboxOption<string>>;
  isLoading: boolean;
  placeholder: string;
}

export function ConnectionSelect({ options, isLoading, placeholder }: ConnectionSelectProps) {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();
  const connectionName = watch('githubApp.connectionName');
  const { connection: selectedConnection } = useConnectionStatus(connectionName);

  return (
    <Controller
      name="githubApp.connectionName"
      control={control}
      rules={{
        required: t('provisioning.wizard.github-app-error-required', 'Connection is required'),
      }}
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
              <Trans i18nKey="provisioning.wizard.github-app-connection-status">Connection status:</Trans>
              <ConnectionStatusBadge status={selectedConnection.status} />
            </Stack>
          )}
        </Stack>
      )}
    />
  );
}
