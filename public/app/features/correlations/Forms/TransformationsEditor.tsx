import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { SupportedTransformationType } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Field, FieldArray, IconButton, Input, InputControl, Select, useStyles2 } from '@grafana/ui';

type Props = {};

const getStyles = () => ({
  // set fixed position from the top instead of centring as the container
  // may get bigger when the for is invalid
  removeButton: css`
    margin-top: 25px;
  `,
});

export const TransformationsEditor = (props: Props) => {
  const { control, formState, register, setValue, watch } = useFormContext();
  const styles = useStyles2(getStyles);

  const transformOptions = getTransformOptions();

  return (
    <FieldArray name="config.transformations" control={control}>
      {({ fields, append, remove }) => (
        <>
          <Stack direction="column" alignItems="flex-start">
            <div>Transformations</div>
            {fields.length === 0 && <div> No transformations defined.</div>}
            {fields.length > 0 && (
              <div>
                {fields.map((field, index) => {
                  return (
                    <Stack direction="row" key={field.id} alignItems="top">
                      <Field
                        label="Type"
                        invalid={!!formState.errors?.config?.transformations?.[index]?.type}
                        error={formState.errors?.config?.transformations?.[index]?.type?.message}
                        validationMessageHorizontalOverflow={true}
                      >
                        <InputControl
                          render={({ field: { onChange, ref, ...field } }) => (
                            <Select
                              {...field}
                              onChange={(value) => {
                                setValue(`config.transformations.${index}.expression`, '');
                                setValue(`config.transformations.${index}.mapValue`, '');
                                onChange(value.value);
                              }}
                              options={transformOptions}
                              aria-label="Type"
                            />
                          )}
                          defaultValue={field.type}
                          control={control}
                          name={`config.transformations.${index}.type`}
                          rules={{ required: { value: true, message: 'Please select a transformation type' } }}
                        />
                      </Field>
                      <Field label="Field">
                        <Input {...register(`config.transformations.${index}.field`)} defaultValue={field.field} />
                      </Field>
                      <Field label="Expression">
                        <Input
                          {...register(`config.transformations.${index}.expression`)}
                          defaultValue={field.expression}
                          disabled={
                            !getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).showExpression
                          }
                        />
                      </Field>
                      <Field label="Map value">
                        <Input
                          {...register(`config.transformations.${index}.mapValue`)}
                          defaultValue={field.mapValue}
                          disabled={
                            !getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).showMapValue
                          }
                        />
                      </Field>
                      <div className={styles.removeButton}>
                        <IconButton
                          type="button"
                          tooltip="Remove transformation"
                          name={'trash-alt'}
                          onClick={() => remove(index)}
                        >
                          Remove
                        </IconButton>
                      </div>
                    </Stack>
                  );
                })}
              </div>
            )}
            <Button icon="plus" onClick={() => append({ type: undefined })} variant="secondary" type="button">
              Add transformation
            </Button>
          </Stack>
        </>
      )}
    </FieldArray>
  );
};

interface SupportedTransformationTypeDetails {
  label: string;
  value: string;
  description?: string;
  showExpression: boolean;
  showMapValue: boolean;
}

function getSupportedTransTypeDetails(transType: SupportedTransformationType): SupportedTransformationTypeDetails {
  switch (transType) {
    case SupportedTransformationType.Logfmt:
      return {
        label: 'Logfmt',
        value: SupportedTransformationType.Logfmt,
        description: 'Parse provided field with logfmt to get variables',
        showExpression: false,
        showMapValue: false,
      };
    case SupportedTransformationType.Regex:
      return {
        label: 'Regular expression',
        value: SupportedTransformationType.Regex,
        description:
          'Field will be parsed with regex. Use named capture groups to return multiple variables, or a single unnamed capture group to add variable to named map value.',
        showExpression: true,
        showMapValue: true,
      };
    default:
      return { label: transType, value: transType, showExpression: false, showMapValue: false };
  }
}

const getTransformOptions = () => {
  return Object.keys(SupportedTransformationType).map((key) => {
    const transType = getSupportedTransTypeDetails(
      SupportedTransformationType[key as keyof typeof SupportedTransformationType]
    );
    return {
      label: transType.label,
      value: transType.value,
      description: transType.description,
    };
  });
};
