import React, { FC } from 'react';
import { Button, Field, Input, InlineLabel, useStyles, Checkbox, IconButton } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { SilenceFormFields } from '../../types/silence-form';

interface Props {
  className?: string;
}

const MatchersField: FC<Props> = ({ className }) => {
  const styles = useStyles(getStyles);
  const formApi = useFormContext<SilenceFormFields>();
  const {
    register,
    formState: { errors },
  } = formApi;
  const { fields: matchers = [], append, remove } = useFieldArray<SilenceFormFields>({ name: 'matchers' });

  return (
    <div className={cx(className, styles.wrapper)}>
      <Field label="Matchers" required>
        <div>
          <div className={styles.matchers}>
            {matchers.map((matcher, index) => {
              return (
                <div className={styles.row} key={`${matcher.id}`}>
                  <Field
                    label="Name"
                    invalid={!!errors?.matchers?.[index]?.name}
                    error={errors?.matchers?.[index]?.name?.message}
                  >
                    <Input
                      {...register(`matchers.${index}.name` as const, {
                        required: { value: true, message: 'Required.' },
                      })}
                      defaultValue={matcher.name}
                      placeholder="name"
                    />
                  </Field>
                  <InlineLabel className={styles.equalSign}>=</InlineLabel>
                  <Field
                    label="Value"
                    invalid={!!errors?.matchers?.[index]?.value}
                    error={errors?.matchers?.[index]?.value?.message}
                  >
                    <Input
                      {...register(`matchers.${index}.value` as const, {
                        required: { value: true, message: 'Required.' },
                      })}
                      defaultValue={matcher.value}
                      placeholder="value"
                    />
                  </Field>
                  <Field className={styles.regexCheckbox} label="Regex">
                    <Checkbox {...register(`matchers.${index}.isRegex` as const)} defaultChecked={matcher.isRegex} />
                  </Field>
                  {matchers.length > 1 && (
                    <IconButton
                      className={styles.removeButton}
                      tooltip="Remove matcher"
                      name={'trash-alt'}
                      onClick={() => remove(index)}
                    >
                      Remove
                    </IconButton>
                  )}
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            icon="plus"
            variant="secondary"
            onClick={() => {
              append({ name: '', value: '', isRegex: false });
            }}
          >
            Add matcher
          </Button>
        </div>
      </Field>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      margin-top: ${theme.spacing.md};
    `,
    row: css`
      display: flex;
      flex-direction: row;
      align-items: center;
      background-color: ${theme.colors.bg2};
      padding: ${theme.spacing.sm} ${theme.spacing.sm} 0 ${theme.spacing.sm};
    `,
    equalSign: css`
      width: 28px;
      justify-content: center;
      margin-left: ${theme.spacing.xs};
      margin-bottom: 0;
    `,
    regexCheckbox: css`
      margin-left: ${theme.spacing.md};
    `,
    removeButton: css`
      margin-left: ${theme.spacing.sm};
    `,
    matchers: css`
      max-width: 585px;
      margin: ${theme.spacing.sm} 0;
      padding-top: ${theme.spacing.xs};
    `,
  };
};

export default MatchersField;
