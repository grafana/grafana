import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SupportedTransformationType } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import {
  Button,
  Field,
  FieldArray,
  Icon,
  IconButton,
  Input,
  InputControl,
  Label,
  Select,
  Tooltip,
  useStyles2,
} from '@grafana/ui';

type Props = { readOnly: boolean };

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css`
    font-size: ${theme.typography.h5.fontSize};
    font-weight: ${theme.typography.fontWeightRegular};
  `,
  // set fixed position from the top instead of centring as the container
  // may get bigger when the for is invalid
  removeButton: css`
    margin-top: 25px;
  `,
});

export const TransformationsEditor = (props: Props) => {
  const { control, formState, register, setValue, watch, getValues } = useFormContext();
  const { readOnly } = props;
  const [keptVals, setKeptVals] = useState<{ [key: string]: { expression: string; mapValue: string } }>({});

  const styles = useStyles2(getStyles);

  const transformOptions = getTransformOptions();

  return (
    <FieldArray name="config.transformations" control={control}>
      {({ fields, append, remove }) => (
        <>
          <Stack direction="column" alignItems="flex-start">
            <div className={styles.heading}>Transformations</div>
            {fields.length === 0 && <div> No transformations defined.</div>}
            {fields.length > 0 && (
              <div>
                {fields.map((field, index) => {
                  return (
                    <Stack direction="row" key={field.id} alignItems="top">
                      <Field
                        label={
                          <Stack gap={0.5}>
                            <Label>Type</Label>
                            <Tooltip
                              content={
                                <div>
                                  <p>The type of transformation that will be applied to the source data.</p>
                                </div>
                              }
                            >
                              <Icon name="info-circle" size="sm" />
                            </Tooltip>
                          </Stack>
                        }
                        invalid={!!formState.errors?.config?.transformations?.[index]?.type}
                        error={formState.errors?.config?.transformations?.[index]?.type?.message}
                        validationMessageHorizontalOverflow={true}
                      >
                        <InputControl
                          render={({ field: { onChange, ref, ...field } }) => (
                            <Select
                              {...field}
                              onChange={(value) => {
                                if (!readOnly) {
                                  const currentValues = getValues().config.transformations[index];
                                  setKeptVals({
                                    ...keptVals,
                                    [index.toString()]: {
                                      expression: currentValues.expression,
                                      mapValue: currentValues.mapValue,
                                    },
                                  });
                                  const newValueDetails = getSupportedTransTypeDetails(value.value);

                                  if (newValueDetails.showExpression) {
                                    setValue(
                                      `config.transformations.${index}.expression`,
                                      keptVals[index.toString()]?.expression || ''
                                    );
                                  } else {
                                    setValue(`config.transformations.${index}.expression`, '');
                                  }

                                  if (newValueDetails.showMapValue) {
                                    setValue(
                                      `config.transformations.${index}.mapValue`,
                                      keptVals[index.toString()]?.mapValue || ''
                                    );
                                  } else {
                                    setValue(`config.transformations.${index}.mapValue`, '');
                                  }

                                  onChange(value.value);
                                }
                              }}
                              options={transformOptions}
                              width={25}
                              aria-label="Type"
                            />
                          )}
                          defaultValue={field.type}
                          control={control}
                          name={`config.transformations.${index}.type`}
                          rules={{ required: { value: true, message: 'Please select a transformation type' } }}
                        />
                      </Field>
                      <Field
                        label={
                          <Stack gap={0.5}>
                            <Label>Field</Label>
                            <Tooltip
                              content={
                                <div>
                                  <p>
                                    Optional. The field to transform. If not specified, the transformation will be
                                    applied to the results field.
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
                          defaultValue={field.field}
                        />
                      </Field>
                      <Field
                        label={
                          <Stack gap={0.5}>
                            <Label>
                              Expression
                              {getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`))
                                .requireExpression
                                ? ' *'
                                : ''}
                            </Label>
                            <Tooltip
                              content={
                                <div>
                                  <p>
                                    Required for regular expression. The expression the transformation will use. Logfmt
                                    does not use further specifications.
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
                          {...register(`config.transformations.${index}.expression`)}
                          defaultValue={field.expression}
                          readOnly={readOnly}
                          disabled={
                            !getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).showExpression
                          }
                          required={
                            getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`))
                              .requireExpression
                          }
                        />
                      </Field>
                      <Field
                        label={
                          <Stack gap={0.5}>
                            <Label>Map value</Label>
                            <Tooltip
                              content={
                                <div>
                                  <p>
                                    Optional. Defines the name of the variable. This is currently only valid for regular
                                    expressions with a single, unnamed capture group.
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
                          defaultValue={field.mapValue}
                          readOnly={readOnly}
                          disabled={
                            !getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).showMapValue
                          }
                        />
                      </Field>
                      {!readOnly && (
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
                      )}
                    </Stack>
                  );
                })}
              </div>
            )}
            {!readOnly && (
              <Button
                icon="plus"
                onClick={() => append({ type: undefined }, { shouldFocus: false })}
                variant="secondary"
                type="button"
              >
                Add transformation
              </Button>
            )}
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
  requireExpression?: boolean;
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
        requireExpression: true,
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
