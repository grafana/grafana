import { css } from '@emotion/css';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { Field, Icon, IconButton, Input, Label, Select, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { FormDTO, getSupportedTransTypeDetails, getTransformOptions } from './types';
type Props = {
  index: number;
  value: Record<string, string>;
  readOnly: boolean;
  remove: (index?: number | number[]) => void;
};

const getStyles = () => ({
  // set fixed position from the top instead of centring as the container
  // may get bigger when the for is invalid
  removeButton: css({
    marginTop: '25px',
  }),
});

const TransformationEditorRow = (props: Props) => {
  const { index, value: defaultValue, readOnly, remove } = props;
  const { control, formState, register, setValue, watch, getValues } = useFormContext<FormDTO>();

  const [keptVals, setKeptVals] = useState<{ expression?: string; mapValue?: string }>({});

  register(`config.transformations.${index}.type`, {
    required: {
      value: true,
      message: t('correlations.transform-row.transform-required', 'Please select a transformation type'),
    },
  });
  const typeValue = useWatch({ name: `config.transformations.${index}.type`, control });

  const styles = useStyles2(getStyles);

  const transformOptions = getTransformOptions();

  return (
    <Stack direction="row" key={defaultValue.id} alignItems="flex-start">
      <Field
        label={
          <Stack gap={0.5}>
            <Label htmlFor={`config.transformations.${defaultValue.id}-${index}.type`}>
              <Trans i18nKey="correlations.transform-row.type-label">Type</Trans>
            </Label>
            <Tooltip
              content={
                <div>
                  <p>
                    <Trans i18nKey="correlations.transform-row.type-tooltip">
                      The type of transformation that will be applied to the source data.
                    </Trans>
                  </p>
                </div>
              }
            >
              <Icon name="info-circle" size="sm" />
            </Tooltip>
          </Stack>
        }
        invalid={!!formState.errors?.config?.transformations?.[index]?.type}
        error={formState.errors?.config?.transformations?.[index]?.message}
        validationMessageHorizontalOverflow={true}
      >
        <Select
          value={typeValue}
          onChange={(value) => {
            if (!readOnly) {
              const currentValues = getValues()?.config?.transformations?.[index];
              if (currentValues) {
                setKeptVals({
                  expression: currentValues.expression,
                  mapValue: currentValues.mapValue,
                });
              }
              if (value.value) {
                const newValueDetails = getSupportedTransTypeDetails(value.value);

                if (newValueDetails.expressionDetails.show) {
                  setValue(`config.transformations.${index}.expression`, keptVals?.expression || '');
                } else {
                  setValue(`config.transformations.${index}.expression`, '');
                }

                if (newValueDetails.mapValueDetails.show) {
                  setValue(`config.transformations.${index}.mapValue`, keptVals?.mapValue || '');
                } else {
                  setValue(`config.transformations.${index}.mapValue`, '');
                }

                setValue(`config.transformations.${index}.type`, value.value);
              }
            }
          }}
          options={transformOptions}
          width={25}
          inputId={`config.transformations.${defaultValue.id}-${index}.type`}
        />
      </Field>
      <Field
        label={
          <Stack gap={0.5}>
            <Label htmlFor={`config.transformations.${defaultValue.id}.field`}>
              <Trans i18nKey="correlations.transform-row.field-label">Field</Trans>
            </Label>
            <Tooltip
              content={
                <div>
                  <p>
                    <Trans i18nKey="correlations.transform-row.field-tooltip">
                      Optional. The field to transform. If not specified, the transformation will be applied to the
                      results field.
                    </Trans>
                  </p>
                </div>
              }
            >
              <Icon name="info-circle" size="sm" />
            </Tooltip>
          </Stack>
        }
      >
        <Input
          {...register(`config.transformations.${index}.field`)}
          readOnly={readOnly}
          defaultValue={defaultValue.field}
          label={t('correlations.transform-row.field-input', 'field')}
          id={`config.transformations.${defaultValue.id}.field`}
        />
      </Field>
      <Field
        label={
          <Stack gap={0.5}>
            <Label htmlFor={`config.transformations.${defaultValue.id}.expression`}>
              <Trans i18nKey="correlations.transform-row.expression-label">Expression</Trans>
              {getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).expressionDetails.required
                ? // eslint-disable-next-line @grafana/no-untranslated-strings
                  ' *'
                : ''}
            </Label>
            <Tooltip
              content={
                <div>
                  <p>
                    <Trans i18nKey="correlations.transform-row.expression-tooltip">
                      Required for regular expression. The expression the transformation will use. Logfmt does not use
                      further specifications.
                    </Trans>
                  </p>
                </div>
              }
            >
              <Icon name="info-circle" size="sm" />
            </Tooltip>
          </Stack>
        }
        invalid={!!formState.errors?.config?.transformations?.[index]?.expression}
        error={formState.errors?.config?.transformations?.[index]?.expression?.message}
      >
        <Input
          {...register(`config.transformations.${index}.expression`, {
            required: getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).expressionDetails
              .required
              ? t('correlations.transform-row.expression-required', 'Please define an expression')
              : undefined,
          })}
          defaultValue={defaultValue.expression}
          readOnly={readOnly}
          disabled={!getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).expressionDetails.show}
          id={`config.transformations.${defaultValue.id}.expression`}
        />
      </Field>
      <Field
        label={
          <Stack gap={0.5}>
            <Label htmlFor={`config.transformations.${defaultValue.id}.mapValue`}>
              <Trans i18nKey="correlations.transform-row.map-value-label">Map value</Trans>
            </Label>
            <Tooltip
              content={
                <div>
                  <p>
                    <Trans i18nKey="correlations.transform-row.map-value-tooltip">
                      Optional. Defines the name of the variable. This is currently only valid for regular expressions
                      with a single, unnamed capture group.
                    </Trans>
                  </p>
                </div>
              }
            >
              <Icon name="info-circle" size="sm" />
            </Tooltip>
          </Stack>
        }
      >
        <Input
          {...register(`config.transformations.${index}.mapValue`)}
          defaultValue={defaultValue.mapValue}
          readOnly={readOnly}
          disabled={!getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).mapValueDetails.show}
          id={`config.transformations.${defaultValue.id}.mapValue`}
        />
      </Field>
      {!readOnly && (
        <div className={styles.removeButton}>
          <IconButton
            tooltip={t('correlations.transform-row.remove-tooltip', 'Remove transformation')}
            name="trash-alt"
            onClick={() => {
              remove(index);
            }}
          >
            <Trans i18nKey="correlations.transform-row.remove-button">Remove</Trans>
          </IconButton>
        </div>
      )}
    </Stack>
  );
};

export default TransformationEditorRow;
