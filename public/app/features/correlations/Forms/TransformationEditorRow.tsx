import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { SupportedTransformationType } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Field, Icon, IconButton, Input, Label, Select, Tooltip, useStyles2 } from '@grafana/ui';

type Props = {
  index: number;
  value: Record<string, string>;
  readOnly: boolean;
  remove: (index?: number | number[]) => void;
};

const getStyles = () => ({
  // set fixed position from the top instead of centring as the container
  // may get bigger when the for is invalid
  removeButton: css`
    margin-top: 25px;
  `,
});

const TransformationEditorRow = (props: Props) => {
  const { index, value: defaultValue, readOnly, remove } = props;
  const { control, formState, register, setValue, watch, getValues } = useFormContext();

  const [keptVals, setKeptVals] = useState<{ expression?: string; mapValue?: string }>({});

  // const { onChange, onBlur, name, ref } = register(`config.transformations.${index}.type`);
  register(`config.transformations.${index}.type`);
  const typeValue = useWatch({ name: `config.transformations.${index}.type`, control });

  const styles = useStyles2(getStyles);

  const transformOptions = getTransformOptions();

  return (
    <Stack direction="row" key={defaultValue.id} alignItems="top">
      <Field
        label={
          <Stack gap={0.5}>
            <Label htmlFor={`config.transformations.${defaultValue.id}-${index}.type`}>Type</Label>
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
        <Select
          value={typeValue}
          onChange={(value) => {
            if (!readOnly) {
              const currentValues = getValues().config.transformations[index];
              setKeptVals({
                expression: currentValues.expression,
                mapValue: currentValues.mapValue,
              });

              const newValueDetails = getSupportedTransTypeDetails(value.value);

              if (newValueDetails.showExpression) {
                setValue(`config.transformations.${index}.expression`, keptVals?.expression || '');
              } else {
                setValue(`config.transformations.${index}.expression`, '');
              }

              if (newValueDetails.showMapValue) {
                setValue(`config.transformations.${index}.mapValue`, keptVals?.mapValue || '');
              } else {
                setValue(`config.transformations.${index}.mapValue`, '');
              }

              setValue(`config.transformations.${index}.type`, value.value);
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
            <Label htmlFor={`config.transformations.${defaultValue.id}.field`}>Field</Label>
            <Tooltip
              content={
                <div>
                  <p>
                    Optional. The field to transform. If not specified, the transformation will be applied to the
                    results field.
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
          label="field"
          id={`config.transformations.${defaultValue.id}.field`}
        />
      </Field>
      <Field
        label={
          <Stack gap={0.5}>
            <Label htmlFor={`config.transformations.${defaultValue.id}.expression`}>
              Expression
              {getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).requireExpression
                ? ' *'
                : ''}
            </Label>
            <Tooltip
              content={
                <div>
                  <p>
                    Required for regular expression. The expression the transformation will use. Logfmt does not use
                    further specifications.
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
            required: getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).requireExpression
              ? 'Please define an expression'
              : undefined,
          })}
          defaultValue={defaultValue.expression}
          readOnly={readOnly}
          disabled={!getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).showExpression}
          id={`config.transformations.${defaultValue.id}.expression`}
        />
      </Field>
      <Field
        label={
          <Stack gap={0.5}>
            <Label htmlFor={`config.transformations.${defaultValue.id}.mapValue`}>Map value</Label>
            <Tooltip
              content={
                <div>
                  <p>
                    Optional. Defines the name of the variable. This is currently only valid for regular expressions
                    with a single, unnamed capture group.
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
          disabled={!getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).showMapValue}
          id={`config.transformations.${defaultValue.id}.mapValue`}
        />
      </Field>
      {!readOnly && (
        <div className={styles.removeButton}>
          <IconButton
            tooltip="Remove transformation"
            name="trash-alt"
            onClick={() => {
              remove(index);
            }}
          >
            Remove
          </IconButton>
        </div>
      )}
    </Stack>
  );
};

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

interface SupportedTransformationTypeDetails {
  label: string;
  value: string;
  description?: string;
  showExpression: boolean;
  showMapValue: boolean;
  requireExpression?: boolean;
}

export default TransformationEditorRow;
