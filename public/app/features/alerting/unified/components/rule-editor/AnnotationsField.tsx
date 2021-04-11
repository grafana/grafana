import React, { FC, useCallback, useState } from 'react';
import { Button, Field, FieldArray, Input, InputControl, Label, Select, TextArea, useStyles } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useFormContext } from 'react-hook-form';
import { RuleFormValues } from '../../types/rule-form';

enum AnnotationOptions {
  description = 'Description',
  dashboard = 'Dashboard',
  summary = 'Summary',
  runbook = 'Runbook URL',
}

const AnnotationsField: FC = () => {
  const styles = useStyles(getStyles);
  const { control, register, watch, errors } = useFormContext<RuleFormValues>();
  const annotations = watch('annotations');

  const [customIndexes, setCustomIndexes] = useState<number[]>([]);

  const annotationOptions = useCallback(
    (index: number): SelectableValue[] => [
      ...Object.entries(AnnotationOptions)
        .filter(([optKey]) => !annotations.find(({ key }, idx) => key === optKey && idx !== index)) // remove keys already taken in other annotations
        .map(([key, value]) => ({ value: key, label: value })),
      { value: '__add__', label: '+ Custom name' },
    ],
    [annotations]
  );

  return (
    <>
      <Label>Summary and annotations</Label>
      <FieldArray name={'annotations'} control={control}>
        {({ fields, append, remove }) => {
          return (
            <div className={styles.flexColumn}>
              {fields.map((field, index) => {
                const customKey = customIndexes.includes(index);
                return (
                  <div key={`${field.annotationKey}-${index}`} className={styles.flexRow}>
                    <Field
                      className={styles.field}
                      invalid={!!errors.annotations?.[index]?.key?.message}
                      error={errors.annotations?.[index]?.key?.message}
                    >
                      <>
                        {!customKey && (
                          <InputControl
                            as={Select}
                            width={15}
                            name={`annotations[${index}].key`}
                            options={annotationOptions(index)}
                            control={control}
                            defaultValue={field.key}
                            onChange={(vals) => {
                              const value = vals[0]?.value;
                              if (value === '__add__') {
                                setCustomIndexes([...customIndexes, index]);
                                return '';
                              }
                              return value;
                            }}
                            rules={{ required: { value: !!annotations[index]?.value, message: 'Required.' } }}
                          />
                        )}
                        {customKey && (
                          <Input
                            width={15}
                            name={`annotations[${index}].key`}
                            autoFocus={true}
                            placeholder="key"
                            ref={register({ required: { value: !!annotations[index]?.value, message: 'Required.' } })}
                          />
                        )}
                      </>
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
                        placeholder={`value`}
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
                        setCustomIndexes(customIndexes.filter((idx) => idx !== index));
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
