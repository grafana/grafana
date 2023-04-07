import { css } from '@emotion/css';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import {
  DataSourceInstanceSettings,
  getSupportedTransTypeDetails,
  GrafanaTheme2,
  SupportedTransformationType,
} from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { DataSourcePicker } from '@grafana/runtime';
import {
  Button,
  Card,
  Field,
  FieldArray,
  FieldSet,
  IconButton,
  Input,
  InputControl,
  Select,
  useStyles2,
} from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { getVariableUsageInfo } from '../../explore/utils/links';

import { useCorrelationsFormContext } from './correlationsFormContext';
import { getInputId } from './utils';

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    max-width: ${theme.spacing(80)};
  `,
  variable: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
  // set fixed position from the top instead of centring as the container
  // may get bigger when the for is invalid
  removeButton: css`
    margin-top: 25px;
  `,
});

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

export const ConfigureCorrelationSourceForm = () => {
  const { control, formState, register, getValues, setValue, watch } = useFormContext();
  const styles = useStyles2(getStyles);
  const withDsUID = (fn: Function) => (ds: DataSourceInstanceSettings) => fn(ds.uid);

  const { correlation, readOnly } = useCorrelationsFormContext();

  const currentTargetQuery = getValues('config.target');
  const variables = getVariableUsageInfo(currentTargetQuery, {}).variables.map(
    (variable) => variable.variableName + (variable.fieldPath ? `.${variable.fieldPath}` : '')
  );

  const transformOptions = getTransformOptions();

  return (
    <>
      <FieldSet label="Configure source data source (3/3)">
        <p>
          Links are displayed with results of the selected origin source data. They show along with the value of the
          provided <em>results field</em>.
        </p>
        <Controller
          control={control}
          name="sourceUID"
          rules={{
            required: { value: true, message: 'This field is required.' },
            validate: {
              writable: (uid: string) =>
                !getDatasourceSrv().getInstanceSettings(uid)?.readOnly || "Source can't be a read-only data source.",
            },
          }}
          render={({ field: { onChange, value } }) => (
            <Field
              label="Source"
              description="Results from selected source data source have links displayed in the panel"
              htmlFor="source"
              invalid={!!formState.errors.sourceUID}
              error={formState.errors.sourceUID?.message}
            >
              <DataSourcePicker
                onChange={withDsUID(onChange)}
                noDefault
                current={value}
                inputId="source"
                width={32}
                disabled={correlation !== undefined}
              />
            </Field>
          )}
        />

        <Field
          label="Results field"
          description="The link will be shown next to the value of this field"
          className={styles.label}
          invalid={!!formState.errors?.config?.field}
          error={formState.errors?.config?.field?.message}
        >
          <Input
            id={getInputId('field', correlation)}
            {...register('config.field', { required: 'This field is required.' })}
            readOnly={readOnly}
          />
        </Field>
        {variables.length > 0 && (
          <Card>
            <Card.Heading>Variables used in the target query</Card.Heading>
            <Card.Description>
              You have used following variables in the target query:{' '}
              {variables.map((name, i) => (
                <span className={styles.variable} key={i}>
                  {name}
                  {i < variables.length - 1 ? ', ' : ''}
                </span>
              ))}
              <br />A data point needs to provide values to all variables as fields or as transformations output to make
              the correlation button appear in the visualization.
            </Card.Description>
          </Card>
        )}
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
                                !getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`))
                                  .showExpression
                              }
                            />
                          </Field>
                          <Field label="Map value">
                            <Input
                              {...register(`config.transformations.${index}.mapValue`)}
                              defaultValue={field.mapValue}
                              disabled={
                                !getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`))
                                  .showMapValue
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
      </FieldSet>
    </>
  );
};
