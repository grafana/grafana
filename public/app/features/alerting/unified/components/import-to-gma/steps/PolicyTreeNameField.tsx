import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, Icon, Input, Label, Stack, Tooltip } from '@grafana/ui';

import { type ImportFormValues } from '../types';

interface PolicyTreeNameFieldProps {
  /** Auto-sync names the policy tree itself, so the field is disabled and not required. */
  autoSyncActive: boolean;
  /** The name the sync will pick, once known. */
  autoSyncIdentifier: string | undefined;
  autoSyncConflictMessage: string | undefined;
  validate: (value: string) => Promise<string | true>;
  onBlur: () => Promise<void>;
}

export function PolicyTreeNameField({
  autoSyncActive,
  autoSyncIdentifier,
  autoSyncConflictMessage,
  validate,
  onBlur,
}: PolicyTreeNameFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ImportFormValues>();

  return (
    <Field
      label={
        autoSyncActive ? (
          <Label>
            <Stack direction="row" alignItems="center" gap={0.5}>
              {t('alerting.import-to-gma.step1.policy-tree-name', 'Policy tree name')}
              <Tooltip
                content={
                  autoSyncIdentifier
                    ? t(
                        'alerting.import-to-gma.step1.policy-tree-autosync-name',
                        'Auto-sync names the policy tree after the data source: {{name}}',
                        { name: autoSyncIdentifier }
                      )
                    : t(
                        'alerting.import-to-gma.step1.policy-tree-autosync-disabled',
                        'Not needed. Auto-sync names the policy tree after the data source.'
                      )
                }
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          </Label>
        ) : (
          t('alerting.import-to-gma.step1.policy-tree-name', 'Policy tree name')
        )
      }
      required={!autoSyncActive}
      invalid={!!errors.policyTreeName || !!autoSyncConflictMessage}
      error={errors.policyTreeName?.message ?? autoSyncConflictMessage}
      noMargin
    >
      <Input
        {...register('policyTreeName', {
          required: autoSyncActive
            ? undefined
            : t('alerting.import-to-gma.step1.policy-tree-required', 'Policy tree name is required'),
          validate: autoSyncActive ? undefined : validate,
          onBlur,
        })}
        disabled={autoSyncActive}
        placeholder={t('alerting.import-to-gma.step1.policy-tree-placeholder', 'e.g. prometheus-prod')}
        width={40}
      />
    </Field>
  );
}
