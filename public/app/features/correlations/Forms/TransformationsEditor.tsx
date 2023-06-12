import { css } from '@emotion/css';
import { compact, fill } from 'lodash';
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
  const [keptVals, setKeptVals] = useState<Array<{ expression?: string; mapValue?: string }>>([]);

  const styles = useStyles2(getStyles);

  const transformOptions = getTransformOptions();
  return (
    <>
      <input type="hidden" {...register('id')} />
      <FieldArray name="config.transformations" control={control}>
        {({ fields, append, remove }) => (
          <>
            <Stack direction="column" alignItems="flex-start">
              <div className={styles.heading}>Transformations</div>
              {fields.length === 0 && <div> No transformations defined.</div>}
              {fields.length > 0 && (
                <div>
                  {fields.map((fieldVal, index) => {
                    return (
                      <Stack direction="row" key={fieldVal.id} alignItems="top">
                        <Field
                          label={
                            <Stack gap={0.5}>
                              <Label htmlFor={`config.transformations.${fieldVal.id}-${index}.type`}>Type</Label>
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
                            render={({ field: { onChange, ref, ...field } }) => {
                              // input control field is not manipulated with remove, use value from control
                              return (
                                <Select
                                  {...field}
                                  value={fieldVal.type}
                                  onChange={(value) => {
                                    if (!readOnly) {
                                      const currentValues = getValues().config.transformations[index];
                                      let keptValsCopy = fill(Array(index + 1), {});
                                      keptVals.forEach((keptVal, i) => (keptValsCopy[i] = keptVal));
                                      keptValsCopy[index] = {
                                        expression: currentValues.expression,
                                        mapValue: currentValues.mapValue,
                                      };

                                      setKeptVals(keptValsCopy);

                                      const newValueDetails = getSupportedTransTypeDetails(value.value);

                                      if (newValueDetails.showExpression) {
                                        setValue(
                                          `config.transformations.${index}.expression`,
                                          keptVals[index]?.expression || ''
                                        );
                                      } else {
                                        setValue(`config.transformations.${index}.expression`, '');
                                      }

                                      if (newValueDetails.showMapValue) {
                                        setValue(
                                          `config.transformations.${index}.mapValue`,
                                          keptVals[index]?.mapValue || ''
                                        );
                                      } else {
                                        setValue(`config.transformations.${index}.mapValue`, '');
                                      }

                                      onChange(value.value);
                                    }
                                  }}
                                  options={transformOptions}
                                  width={25}
                                  inputId={`config.transformations.${fieldVal.id}-${index}.type`}
                                />
                              );
                            }}
                            control={control}
                            name={`config.transformations.${index}.type`}
                            rules={{ required: { value: true, message: 'Please select a transformation type' } }}
                          />
                        </Field>
                        <Field
                          label={
                            <Stack gap={0.5}>
                              <Label htmlFor={`config.transformations.${fieldVal.id}.field`}>Field</Label>
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
                            defaultValue={fieldVal.field}
                            label="field"
                            id={`config.transformations.${fieldVal.id}.field`}
                          />
                        </Field>
                        <Field
                          label={
                            <Stack gap={0.5}>
                              <Label htmlFor={`config.transformations.${fieldVal.id}.expression`}>
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
                                      Required for regular expression. The expression the transformation will use.
                                      Logfmt does not use further specifications.
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
                              required: getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`))
                                .requireExpression
                                ? 'Please define an expression'
                                : undefined,
                            })}
                            defaultValue={fieldVal.expression}
                            readOnly={readOnly}
                            disabled={
                              !getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`))
                                .showExpression
                            }
                            id={`config.transformations.${fieldVal.id}.expression`}
                          />
                        </Field>
                        <Field
                          label={
                            <Stack gap={0.5}>
                              <Label htmlFor={`config.transformations.${fieldVal.id}.mapValue`}>Map value</Label>
                              <Tooltip
                                content={
                                  <div>
                                    <p>
                                      Optional. Defines the name of the variable. This is currently only valid for
                                      regular expressions with a single, unnamed capture group.
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
                            defaultValue={fieldVal.mapValue}
                            readOnly={readOnly}
                            disabled={
                              !getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).showMapValue
                            }
                            id={`config.transformations.${fieldVal.id}.mapValue`}
                          />
                        </Field>
                        {!readOnly && (
                          <div className={styles.removeButton}>
                            <IconButton
                              tooltip="Remove transformation"
                              name="trash-alt"
                              onClick={() => {
                                remove(index);
                                const keptValsCopy: Array<{ expression?: string; mapValue?: string } | undefined> = [
                                  ...keptVals,
                                ];
                                keptValsCopy[index] = undefined;
                                setKeptVals(compact(keptValsCopy));
                              }}
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
    </>
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
  return Object.values(SupportedTransformationType).map((transformationType) => {
    const transType = getSupportedTransTypeDetails(transformationType);
    return {
      label: transType.label,
      value: transType.value,
      description: transType.description,
    };
  });
};
