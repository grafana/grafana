import { useFormContext } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Field, Input, Stack, Text } from '@grafana/ui';

import { StackFormSection } from './StackFormSection';
import { StackFormValues } from './types';

export const StackName = () => {
  const {
    register,
    formState: { errors },
  } = useFormContext<StackFormValues>();

  return (
    <StackFormSection
      stepNo={1}
      title={t('datasources.stack-name.title', 'Enter stack name')}
      description={
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="datasources.stack-name.description">Enter a name to identify your stack.</Trans>
        </Text>
      }
    >
      <Stack direction="column">
        <Field
          label={t('datasources.stack-name.label', 'Name')}
          error={errors?.name?.message}
          invalid={!!errors.name?.message}
        >
          <Input
            data-testid={selectors.components.AlertRules.ruleNameField}
            id="name"
            width={38}
            {...register('name', {
              required: {
                value: true,
                message: t('datasources.stack-name.required', 'Must enter a name'),
              },
            })}
            aria-label={t('datasources.stack-name.aria-label', 'name')}
            placeholder="example: LGTM"
          />
        </Field>
      </Stack>
    </StackFormSection>
  );
};
