import { css, cx } from '@emotion/css';
import React, { FC, useCallback } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { GrafanaTheme } from '@grafana/data';
import { Button, Field, Input, InputControl, Label, TextArea, useStyles } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';

import { AnnotationKeyInput } from './AnnotationKeyInput';

const AnnotationsField: FC = () => {
  const styles = useStyles(getStyles);
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();
  const annotations = watch('annotations');

  const existingKeys = useCallback(
    (index: number): string[] => annotations.filter((_, idx: number) => idx !== index).map(({ key }) => key),
    [annotations]
  );

  const { fields, append, remove } = useFieldArray({ control, name: 'annotations' });

  return (
    <>
      <Label>Summary and annotations</Label>
      <div className={styles.flexColumn}>
        {fields.map((annotationField, index) => {
          const isUrl = annotations[index]?.key?.toLocaleLowerCase().endsWith('url');
          const ValueInputComponent = isUrl ? Input : TextArea;

          return (
            <div key={annotationField.id} className={styles.flexRow}>
              <Field
                className={styles.field}
                invalid={!!errors.annotations?.[index]?.key?.message}
                error={errors.annotations?.[index]?.key?.message}
                data-testid={`annotation-key-${index}`}
              >
                <InputControl
                  name={`annotations.${index}.key`}
                  defaultValue={annotationField.key}
                  render={({ field: { ref, ...field } }) => (
                    <AnnotationKeyInput
                      {...field}
                      aria-label={`Annotation detail ${index + 1}`}
                      existingKeys={existingKeys(index)}
                      width={18}
                    />
                  )}
                  control={control}
                  rules={{ required: { value: !!annotations[index]?.value, message: 'Required.' } }}
                />
              </Field>
              <Field
                className={cx(styles.flexRowItemMargin, styles.field)}
                invalid={!!errors.annotations?.[index]?.value?.message}
                error={errors.annotations?.[index]?.value?.message}
              >
                <ValueInputComponent
                  data-testid={`annotation-value-${index}`}
                  className={cx(styles.annotationValueInput, { [styles.textarea]: !isUrl })}
                  {...register(`annotations.${index}.value`)}
                  placeholder={isUrl ? 'https://' : `Text`}
                  defaultValue={annotationField.value}
                />
              </Field>
              <Button
                type="button"
                className={styles.flexRowItemMargin}
                aria-label="delete annotation"
                icon="trash-alt"
                variant="secondary"
                onClick={() => remove(index)}
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
            append({ key: '', value: '' });
          }}
        >
          Add info
        </Button>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  annotationValueInput: css`
    width: 426px;
  `,
  textarea: css`
    height: 76px;
  `,
  addAnnotationsButton: css`
    flex-grow: 0;
    align-self: flex-start;
    margin-left: 148px;
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
