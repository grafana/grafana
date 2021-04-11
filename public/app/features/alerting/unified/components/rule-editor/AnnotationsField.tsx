import React, { FC } from 'react';
import { Button, Field, FieldArray, InputControl, Label, Select, TextArea, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useFormContext } from 'react-hook-form';
import { RuleFormValues } from '../../types/rule-form';

enum AnnotationOptions {
  summary = 'Summary',
  description = 'Description',
  runbook = 'Runbook url',
}

const AnnotationsField: FC = () => {
  const styles = useStyles(getStyles);
  const annotationOptions = Object.entries(AnnotationOptions).map(([key, value]) => ({ value: key, label: value }));
  const { control, register, watch, errors } = useFormContext<RuleFormValues>();
  const annotations = watch('annotations');

  return (
    <>
      <Label>Summary and annotations</Label>
      <FieldArray name={'annotations'} control={control}>
        {({ fields, append, remove }) => {
          return (
            <div className={styles.flexColumn}>
              {fields.map((field, index) => {
                return (
                  <div key={`${field.annotationKey}-${index}`} className={styles.flexRow}>
                    <Field
                      className={styles.field}
                      invalid={!!errors.annotations?.[index]?.key?.message}
                      error={errors.annotations?.[index]?.key?.message}
                    >
                      <InputControl
                        as={Select}
                        width={14}
                        name={`annotations[${index}].key`}
                        options={annotationOptions}
                        control={control}
                        defaultValue={field.key}
                        rules={{ required: { value: !!annotations[index]?.value, message: 'Required.' } }}
                      />
                    </Field>
                    <Field
                      className={cx(styles.flexRowItemMargin, styles.field)}
                      invalid={!!errors.annotations?.[index]?.value?.message}
                      error={errors.annotations?.[index]?.value?.message}
                    >
                      <TextArea
                        name={`annotations[${index}].value`}
                        className={styles.annotationTextArea}
                        ref={register({ required: { value: !!annotations[index]?.key, message: 'Required.' } })}
                        placeholder={`Text`}
                        defaultValue={field.value}
                      />
                    </Field>
                    <Button
                      type="button"
                      className={styles.flexRowItemMargin}
                      aria-label="delete annotation"
                      icon="trash-alt"
                      variant="secondary"
                      onClick={() => {
                        remove(index);
                      }}
                    />
                  </div>
                );
              })}
              <Button
                className={styles.addAnnotationsButton}
                icon="plus-circle"
                type="button"
                variant="secondary"
                onClick={() => {
                  append({});
                }}
              >
                Add info
              </Button>
            </div>
          );
        }}
      </FieldArray>
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  annotationTextArea: css`
    width: 450px;
    height: 76px;
  `,
  addAnnotationsButton: css`
    flex-grow: 0;
    align-self: flex-start;
    margin-left: 116px;
  `,
  flexColumn: css`
    display: flex;
    flex-direction: column;
  `,
  field: css`
    margin-bottom: ${theme.spacing.xs};
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
  `,
  flexRowItemMargin: css`
    margin-left: ${theme.spacing.xs};
  `,
});

export default AnnotationsField;
