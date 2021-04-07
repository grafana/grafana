import React, { FC } from 'react';
import { Button, Field, FieldArray, Input, InlineLabel, IconButton, Label, stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { config } from 'app/core/config';
import { css, cx } from '@emotion/css';
import { useFormContext } from 'react-hook-form';
import { RuleFormValues } from '../../types/rule-form';

interface Props {
  className?: string;
}

const LabelsField: FC<Props> = ({ className }) => {
  const styles = getStyles(config.theme);
  const { register, control } = useFormContext<RuleFormValues>();
  return (
    <div className={className}>
      <Label>Custom Labels</Label>
      <FieldArray control={control} name="labels">
        {({ fields, append, remove }) => {
          return (
            <>
              <div className={styles.flexRow}>
                <InlineLabel width={12}>Labels</InlineLabel>
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
                          <div className={styles.equalSign}>=</div>
                          <Field className={styles.labelInput}>
                            <Input
                              ref={register()}
                              name={`labels[${index}].value`}
                              placeholder="value"
                              defaultValue={field.value}
                            />
                          </Field>
                          <IconButton
                            aria-label="delete label"
                            name="trash-alt"
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
                    size="sm"
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

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
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
      width: ${theme.spacing.lg};
      height: ${theme.spacing.lg};
      padding: ${theme.spacing.sm};
      line-height: ${theme.spacing.sm};
      background-color: ${theme.colors.bg2};
      margin: 0 ${theme.spacing.xs};
    `,
    labelInput: css`
      width: 200px;
      margin-bottom: ${theme.spacing.sm};
      & + & {
        margin-left: ${theme.spacing.sm};
      }
    `,
  };
});

export default LabelsField;
