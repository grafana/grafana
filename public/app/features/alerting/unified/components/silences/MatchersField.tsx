import React, { FC } from 'react';
import { Button, Field, FieldArray, Input, InlineLabel, Label, useStyles, Checkbox } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useFormContext } from 'react-hook-form';
import { SilenceFormFields } from '../../types/silence-form';

interface Props {
  className?: string;
}

const MatchersField: FC<Props> = ({ className }) => {
  const styles = useStyles(getStyles);
  const { register, control, watch, errors } = useFormContext<SilenceFormFields>();
  const matchers = watch('matchers');
  return (
    <div className={cx(className, styles.wrapper)}>
      <Label>Matchers</Label>
      <FieldArray control={control} name="matchers">
        {({ fields, append, remove }) => {
          return (
            <>
              <div className={styles.flexRow}>
                <InlineLabel width={15}>Matchers</InlineLabel>
                <div className={styles.flexColumn}>
                  {fields.map((field, index) => {
                    return (
                      <div key={field.id}>
                        <div className={cx(styles.flexRow, styles.centerAlignRow)}>
                          <Field
                            className={styles.labelInput}
                            invalid={!!errors.matchers?.[index]?.name?.message}
                            error={errors.matchers?.[index]?.name?.message}
                          >
                            <Input
                              ref={register({ required: { value: !!matchers[index]?.value, message: 'Required.' } })}
                              name={`matchers[${index}].name`}
                              placeholder="name"
                              defaultValue={field.name}
                            />
                          </Field>
                          <InlineLabel className={styles.equalSign}>=</InlineLabel>
                          <Field
                            className={styles.labelInput}
                            invalid={!!errors.matchers?.[index]?.value?.message}
                            error={errors.matchers?.[index]?.value?.message}
                          >
                            <Input
                              ref={register({ required: { value: !!matchers[index]?.name, message: 'Required.' } })}
                              name={`matchers[${index}].value`}
                              placeholder="value"
                              defaultValue={field.value}
                            />
                          </Field>
                          <Field label="Regex" className={styles.regexCheckbox}>
                            <Checkbox
                              ref={register()}
                              name={`matchers[${index}].isRegex`}
                              defaultChecked={field.isRegex}
                            />
                          </Field>
                          <Button
                            className={styles.deleteLabelButton}
                            aria-label="delete matcher"
                            icon="trash-alt"
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
                    Add matcher
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
    deleteLabelButton: css`
      margin-left: ${theme.spacing.xs};
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
      margin-left: ${theme.spacing.xs};
    `,
    regexCheckbox: css`
      padding: 0 ${theme.spacing.sm};
      width: 44px;
    `,
    labelInput: css`
      width: 207px;
      margin-bottom: ${theme.spacing.sm};
      & + & {
        margin-left: ${theme.spacing.sm};
      }
    `,
  };
};

export default MatchersField;
