import { type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { ControlledCollapse, Field, Input, Stack } from '@grafana/ui';

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  maxConcurrentName: Path<T>;
  requestsPerSecondName: Path<T>;
  burstName: Path<T>;
  maxConcurrentError?: string;
  requestsPerSecondError?: string;
  burstError?: string;
}

const toOptionalNumber = (value: string) => (value === '' ? undefined : Number(value));

export function PureGitRequestLimitsSection<T extends FieldValues>({
  register,
  maxConcurrentName,
  requestsPerSecondName,
  burstName,
  maxConcurrentError,
  requestsPerSecondError,
  burstError,
}: Props<T>) {
  const validateLimit = (value: unknown) =>
    value === undefined ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0) ||
    t('provisioning.pure-git-request-limits.error-non-negative-integer', 'Enter zero or a positive integer.');

  const registrationOptions = {
    setValueAs: toOptionalNumber,
    validate: validateLimit,
  };

  return (
    <ControlledCollapse
      label={t('provisioning.pure-git-request-limits.label-section', 'Request limits')}
      isOpen={Boolean(maxConcurrentError || requestsPerSecondError || burstError)}
    >
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={t('provisioning.pure-git-request-limits.label-max-concurrent', 'Maximum concurrent requests')}
          description={t(
            'provisioning.pure-git-request-limits.description-max-concurrent',
            'Maximum number of concurrent Git requests. Use 0 for unlimited.'
          )}
          error={maxConcurrentError}
          invalid={Boolean(maxConcurrentError)}
        >
          <Input
            {...register(maxConcurrentName, registrationOptions)}
            id="pure-git-max-concurrent"
            type="number"
            min={0}
            step={1}
            placeholder={String(0)}
          />
        </Field>

        <Field
          noMargin
          label={t('provisioning.pure-git-request-limits.label-requests-per-second', 'Requests per second')}
          description={t(
            'provisioning.pure-git-request-limits.description-requests-per-second',
            'Sustained Git request rate. Use 0 for unlimited.'
          )}
          error={requestsPerSecondError}
          invalid={Boolean(requestsPerSecondError)}
        >
          <Input
            {...register(requestsPerSecondName, registrationOptions)}
            id="pure-git-requests-per-second"
            type="number"
            min={0}
            step={1}
            placeholder={String(0)}
          />
        </Field>

        <Field
          noMargin
          label={t('provisioning.pure-git-request-limits.label-burst', 'Burst')}
          description={t(
            'provisioning.pure-git-request-limits.description-burst',
            'Leave empty or set to 0 to use the default burst size of 1 request.'
          )}
          error={burstError}
          invalid={Boolean(burstError)}
        >
          <Input
            {...register(burstName, registrationOptions)}
            id="pure-git-burst"
            type="number"
            min={0}
            step={1}
            placeholder={String(0)}
          />
        </Field>
      </Stack>
    </ControlledCollapse>
  );
}
