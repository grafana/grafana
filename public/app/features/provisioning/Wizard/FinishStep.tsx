import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Checkbox, Field, Input, Stack, Text, TextLink } from '@grafana/ui';

import { checkImageRenderer, checkPublicAccess } from '../GettingStarted/features';

import { getProviderFields } from './fields';
import { WizardFormData } from './types';

export function FinishStep() {
  const { register, watch, setValue } = useFormContext<WizardFormData>();

  const [type, readOnly] = watch(['repository.type', 'repository.readOnly']);
  const getFieldConfig = getProviderFields(type);

  const isGithub = type === 'github';
  const isGitBased = ['github', 'gitlab', 'bitbucket', 'git'].includes(type);
  const isPublic = checkPublicAccess();
  const hasImageRenderer = checkImageRenderer();

  // Set sync enabled by default
  useEffect(() => {
    setValue('repository.sync.enabled', true);
  }, [setValue]);

  // Get field config for interval seconds
  const intervalConfig = getFieldConfig('sync.intervalSeconds');

  return (
    <Stack direction="column">
      {isGitBased && intervalConfig && (
        <Field
          noMargin
          label={intervalConfig.label}
          description={intervalConfig.description}
          required={intervalConfig.required}
        >
          <Input
            {...register('repository.sync.intervalSeconds', {
              valueAsNumber: true,
              required: intervalConfig.validation?.required,
            })}
            type="number"
            placeholder={intervalConfig.placeholder}
          />
        </Field>
      )}

      <Field noMargin>
        <Checkbox
          {...register('repository.readOnly', {
            onChange: (e) => {
              if (e.target.checked) {
                setValue('repository.prWorkflow', false);
              }
            },
          })}
          label={t('provisioning.finish-step.label-read-only', 'Read only')}
          description={t(
            'provisioning.finish-step.description-read-only',
            "Resources can't be modified through Grafana."
          )}
        />
      </Field>

      {isGitBased && !readOnly && (
        <Field noMargin>
          <Checkbox
            {...register('repository.prWorkflow')}
            label={t('provisioning.finish-step.label-enable-pull-requests', 'Enable pull request option when saving')}
            description={t(
              'provisioning.finish-step.description-enable-pull-requests',
              'Allows users to choose whether to open a pull request when saving changes. If the repository does not allow direct changes to the main branch, a pull request may still be required.'
            )}
          />
        </Field>
      )}

      {isGithub && !readOnly && (
        <Field noMargin>
          <Checkbox
            {...register('repository.generateDashboardPreviews')}
            label={t('provisioning.finish-step.label-generate-dashboard-previews', 'Generate Dashboard Previews')}
            description={
              <>
                <Trans i18nKey="provisioning.finish-step.description-generate-dashboard-previews">
                  Create preview links for pull requests
                </Trans>
                {(!isPublic || !hasImageRenderer) && (
                  <>
                    {' '}
                    <Text color="secondary">
                      <Trans i18nKey="provisioning.finish-step.description-preview-requirements">
                        (requires{' '}
                        <TextLink href="https://grafana.com/docs/grafana/latest/setup-grafana/image-rendering/">
                          image rendering
                        </TextLink>{' '}
                        and public access enabled)
                      </Trans>
                    </Text>
                  </>
                )}
              </>
            }
            disabled={!isPublic || !hasImageRenderer}
          />
        </Field>
      )}
    </Stack>
  );
}
