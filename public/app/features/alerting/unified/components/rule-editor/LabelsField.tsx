import React, { FC } from 'react';
import { Button, Field, FieldArray, Input, InlineLabel, Label, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useFormContext } from 'react-hook-form';
import { RuleFormValues } from '../../types/rule-form';

interface Props {
  className?: string;
}

const LabelsField: FC<Props> = ({ className }) => {
  const styles = useStyles(getStyles);
  const { register, control } = useFormContext<RuleFormValues>();
  return (
    <div className={cx(className, styles.wrapper)}>
      <Label>Custom Labels</Label>
      <FieldArray control={control} name="labels">
        {({ fields, append, remove }) => {
          return (
            <>
              <div className={styles.flexRow}>
                <InlineLabel width={14}>Labels</InlineLabel>
                <div className={styles.flexColumn}>
                  {fields.map((field, index) => {
                    return (
                      <div key={field.id}>
                        <div className={cx(styles.flexRow, styles.centerAlignRow)}>
                          <Field className={styles.labelInput}>
                            <Input
                              ref={register()}
                              name={`labels[${index}].key`}
                              placeholder="key"
                              defaultValue={field.key}
                            />
                          </Field>
                          <InlineLabel className={styles.equalSign}>=</InlineLabel>
                          <Field className={styles.labelInput}>
                            <Input
                              ref={register()}
                              name={`labels[${index}].value`}
                              placeholder="value"
                              defaultValue={field.value}
                            />
                          </Field>
                          <Button
                            aria-label="delete label"
                            icon="trash-alt"
                            size="sm"
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
          );
        }}
      </FieldArray>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      margin-top: ${theme.spacing.md};
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
        margin-left: ${theme.spacing.xs};
      }
    `,
    addLabelButton: css`
      flex-grow: 0;
      align-self: flex-start;
    `,
    centerAlignRow: css`
      align-items: baseline;
    `,
    equalSign: css`
      width: 28px;
      justify-content: center;
      margin-left: ${theme.spacing.xs};
    `,
    labelInput: css`
      width: 208px;
      margin-bottom: ${theme.spacing.sm};
      & + & {
        margin-left: ${theme.spacing.sm};
      }
    `,
  };
};

export default LabelsField;
