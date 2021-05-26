import React, { FC } from 'react';
import { Button, Field, Input, Checkbox, IconButton, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { SilenceFormFields } from '../../types/silence-form';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';

interface Props {
  className?: string;
}

const MatchersField: FC<Props> = ({ className }) => {
  const styles = useStyles2(getStyles);
  const formApi = useFormContext<SilenceFormFields>();
  const {
    register,
    formState: { errors },
  } = formApi;
  const { fields: matchers = [], append, remove } = useFieldArray<SilenceFormFields>({ name: 'matchers' });

  return (
    <div className={cx(className, styles.wrapper)}>
      <Field label="Matching labels" required>
        <div>
          <div className={styles.matchers}>
            {matchers.map((matcher, index) => {
              return (
                <div className={styles.row} key={`${matcher.id}`}>
                  <Field
                    label="Label"
                    invalid={!!errors?.matchers?.[index]?.name}
                    error={errors?.matchers?.[index]?.name?.message}
                  >
                    <Input
                      {...register(`matchers.${index}.name` as const, {
                        required: { value: true, message: 'Required.' },
                      })}
                      defaultValue={matcher.name}
                      placeholder="label"
                    />
                  </Field>
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
                  <Field label="Regex">
                    <Checkbox {...register(`matchers.${index}.isRegex` as const)} defaultChecked={matcher.isRegex} />
                  </Field>
                  <Field label="Equal">
                    <Checkbox {...register(`matchers.${index}.isEqual` as const)} defaultChecked={matcher.isEqual} />
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
              const newMatcher: Matcher = { name: '', value: '', isRegex: false, isEqual: true };
              append(newMatcher);
            }}
          >
            Add matcher
          </Button>
        </div>
      </Field>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      margin-top: ${theme.spacing(2)};
    `,
    row: css`
      display: flex;
      align-items: flex-start;
      flex-direction: row;
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(1)} ${theme.spacing(1)} 0 ${theme.spacing(1)};
      & > * + * {
        margin-left: ${theme.spacing(2)};
      }
    `,
    removeButton: css`
      margin-left: ${theme.spacing(1)};
      margin-top: ${theme.spacing(2.5)};
    `,
    matchers: css`
      max-width: 585px;
      margin: ${theme.spacing(1)} 0;
      padding-top: ${theme.spacing(0.5)};
    `,
  };
};

export default MatchersField;
