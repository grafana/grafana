import { useId, useMemo } from 'react';
import { Controller } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Combobox, ComboboxOption, Field, Input } from '@grafana/ui';

import { CorrelationType, CorrelationFormInformationProps } from '../types';

import { FormSection } from './FormSection';

export const CorrelationFormInformation = ({
  control,
  register,
  getValues,
  setValue,
  defaultLabel,
  selectedType,
}: CorrelationFormInformationProps) => {
  const id = useId();

  const typeOptions: Array<ComboboxOption<CorrelationType>> = useMemo(
    () => [
      {
        label: t('explore.correlation-form-information.type-options.label.explore-query', 'Explore Query'),
        value: CorrelationType.ExploreQuery,
      },
      {
        label: t('explore.correlation-form-information.type-options.label.link', 'Link'),
        value: CorrelationType.Link,
      },
    ],
    []
  );

  return (
    <FormSection title={<Trans i18nKey="explore.correlation-helper.title-correlation-info">Correlation Info</Trans>}>
      <Field noMargin label={t('explore.correlation-form-information.label-type', 'Type')} htmlFor={`${id}-type`}>
        <Controller
          name="type"
          control={control}
          render={({ field: { onChange, value } }) => {
            return (
              <Combobox
                id={`${id}-type`}
                options={typeOptions}
                value={value || CorrelationType.ExploreQuery}
                onChange={(option) => onChange(option?.value || CorrelationType.ExploreQuery)}
              />
            );
          }}
        />
      </Field>

      {selectedType === CorrelationType.Link && (
        <Field
          noMargin
          label={t('explore.correlation-form-information.label-url', 'URL')}
          description={t(
            'explore.correlation-form-information.url-description',
            'Specify the URL that will open when the link is clicked'
          )}
          htmlFor={`${id}-url`}
        >
          <Input
            {...register('url')}
            id={`${id}-url`}
            placeholder={t('explore.correlation-form-information.url-placeholder', 'https://example.com')}
          />
        </Field>
      )}

      <Field noMargin label={t('explore.correlation-form-information.label-name', 'Name')} htmlFor={`${id}-label`}>
        <Input
          {...register('label')}
          id={`${id}-label`}
          onBlur={() => {
            if (getValues('label') === '' && defaultLabel !== undefined) {
              setValue('label', defaultLabel);
            }
          }}
        />
      </Field>
      <Field
        noMargin
        label={t('explore.correlation-form-information.label-description', 'Description')}
        htmlFor={`${id}-description`}
      >
        <Input {...register('description')} id={`${id}-description`} />
      </Field>
    </FormSection>
  );
};
