import { css, cx } from '@emotion/css';
import React, { FC, useMemo } from 'react';
import { FieldArrayWithId, useFieldArray, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, Field, InlineLabel, Label, useStyles2 } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';
import AlertLabelDropdown, { AlertLabelDropdownProps } from '../AlertLabelDropdown';

interface Props {
  className?: string;
}

const LabelsField: FC<Props> = ({ className }) => {
  const styles = useStyles2(getStyles);
  const {
    register,
    control,
    watch,
    formState: { errors },
    setValue,
  } = useFormContext<RuleFormValues>();

  const labels = watch('labels');
  const { fields, append, remove } = useFieldArray({ control, name: 'labels' });

  const getDistinctDropdownOptions = (
    fields: Array<FieldArrayWithId<RuleFormValues, 'labels', 'id'>>,
    type: AlertLabelDropdownProps['type']
  ) =>
    [...new Set(fields.map((field) => field[type]))]
      .filter((field) => Boolean(field))
      .map((field) => ({ label: field, value: field }));

  const keys = useMemo(() => {
    return getDistinctDropdownOptions(fields, 'key');
  }, [fields]);

  const values = useMemo(() => {
    return getDistinctDropdownOptions(fields, 'value');
  }, [fields]);

  return (
    <div className={cx(className, styles.wrapper)}>
      <Label>Custom Labels</Label>
      <>
        <div className={styles.flexRow}>
          <InlineLabel width={18}>Labels</InlineLabel>
          <div className={styles.flexColumn}>
            {fields.map((field, index) => {
              return (
                <div key={field.id}>
                  <div className={cx(styles.flexRow, styles.centerAlignRow)}>
                    <Field
                      className={styles.labelInput}
                      invalid={Boolean(errors.labels?.[index]?.key?.message)}
                      error={errors.labels?.[index]?.key?.message}
                      data-testid={`label-key-${index}`}
                    >
                      <AlertLabelDropdown
                        {...register(`labels.${index}.key`, {
                          required: { value: Boolean(labels[index]?.value), message: 'Required.' },
                        })}
                        defaultValue={field.key ? { label: field.key, value: field.key } : undefined}
                        options={keys}
                        onChange={(newValue: SelectableValue) => setValue(`labels.${index}.key`, newValue.value)}
                        type="key"
                      />
                    </Field>
                    <InlineLabel className={styles.equalSign}>=</InlineLabel>
                    <Field
                      className={styles.labelInput}
                      invalid={Boolean(errors.labels?.[index]?.value?.message)}
                      error={errors.labels?.[index]?.value?.message}
                      data-testid={`label-value-${index}`}
                    >
                      <AlertLabelDropdown
                        {...register(`labels.${index}.value`, {
                          required: { value: Boolean(labels[index]?.key), message: 'Required.' },
                        })}
                        defaultValue={field.value ? { label: field.value, value: field.value } : undefined}
                        options={values}
                        onChange={(newValue: SelectableValue) => setValue(`labels.${index}.value`, newValue.value)}
                        type="value"
                      />
                    </Field>

                    <Button
                      className={styles.deleteLabelButton}
                      aria-label="delete label"
                      icon="trash-alt"
                      data-testid={`delete-label-${index}`}
                      variant="secondary"
                      onClick={() => {
                        remove(index);
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <Button
              className={styles.addLabelButton}
              icon="plus-circle"
              type="button"
              variant="secondary"
              onClick={() => {
                append({});
              }}
            >
              Add label
            </Button>
          </div>
        </div>
      </>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      margin-bottom: ${theme.spacing(4)};
    `,
    flexColumn: css`
      display: flex;
      flex-direction: column;
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;

      & + button {
        margin-left: ${theme.spacing(0.5)};
      }
    `,
    deleteLabelButton: css`
      margin-left: ${theme.spacing(0.5)};
      align-self: flex-start;
    `,
    addLabelButton: css`
      flex-grow: 0;
      align-self: flex-start;
    `,
    centerAlignRow: css`
      align-items: baseline;
    `,
    equalSign: css`
      align-self: flex-start;
      width: 28px;
      justify-content: center;
      margin-left: ${theme.spacing(0.5)};
    `,
    labelInput: css`
      width: 175px;
      margin-bottom: ${theme.spacing(1)};
      & + & {
        margin-left: ${theme.spacing(1)};
      }
    `,
  };
};

export default LabelsField;
