import { type UseFormRegister } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Checkbox, Field, Text, TextLink } from '@grafana/ui';

import { type RepositoryFormData } from '../types';

export interface DashboardPreviewFieldProps {
  register: UseFormRegister<RepositoryFormData>;
  disabled?: boolean;
}

export function DashboardPreviewField({ register, disabled }: DashboardPreviewFieldProps) {
  return (
    <Field noMargin>
      <Checkbox
        disabled={disabled}
        label={t('provisioning.finish-step.label-enable-previews', 'Enable dashboard previews in pull requests')}
        description={
          <>
            <Trans i18nKey="provisioning.finish-step.description-enable-previews">
              Adds an image preview of dashboard changes in pull requests. Images of your Grafana dashboards will be
              shared in your Git repository and visible to anyone with repository access.
            </Trans>{' '}
            <Text italic>
              <Trans i18nKey="provisioning.finish-step.description-image-rendering">
                Requires image rendering.{' '}
                <TextLink
                  variant="bodySmall"
                  external
                  href="https://grafana.com/grafana/plugins/grafana-image-renderer"
                >
                  Set up image rendering
                </TextLink>
              </Trans>
            </Text>
          </>
        }
        {...register('generateDashboardPreviews')}
      />
    </Field>
  );
}
