import { css, cx } from '@emotion/css';
import { useEffect } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Divider, Field, IconButton, Input, Select, useStyles2 } from '@grafana/ui';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

import { SilenceFormFields } from '../../types/silence-form';
import { matcherFieldOptions } from '../../utils/alertmanager';

interface Props {
  className?: string;
  required: boolean;
  ruleUid?: string;
}

const MatchersField = ({ className, required, ruleUid }: Props) => {
  const styles = useStyles2(getStyles);
  const formApi = useFormContext<SilenceFormFields>();
  const {
    control,
    register,
    formState: { errors },
  } = formApi;

  const { fields: matchers = [], append, remove } = useFieldArray<SilenceFormFields>({ name: 'matchers' });

  const [getAlertRule, { data: alertRule }] = alertRuleApi.endpoints.getAlertRule.useLazyQuery();
  useEffect(() => {
    // If we have a UID, fetch the alert rule details so we can display the rule name
    if (ruleUid) {
      getAlertRule({ uid: ruleUid });
    }
  }, [getAlertRule, ruleUid]);

  return (
    <div className={className}>
      <Field label="Refine affected alerts" required={required}>
        <div>
          <div className={cx(styles.matchers, styles.indent)}>
            {alertRule && (
              <div>
                <Field label="Alert rule" disabled>
                  <Input id="alert-rule-name" defaultValue={alertRule.grafana_alert.title} disabled />
                </Field>
                <Divider />
              </div>
            )}
            {matchers.map((matcher, index) => {
              return (
                <div className={styles.row} key={`${matcher.id}`} data-testid="matcher">
                  <Field
                    label="Label"
                    invalid={!!errors?.matchers?.[index]?.name}
                    error={errors?.matchers?.[index]?.name?.message}
                  >
                    <Input
                      {...register(`matchers.${index}.name` as const, {
                        required: { value: required, message: 'Required.' },
                      })}
                      defaultValue={matcher.name}
                      placeholder="label"
                      id={`matcher-${index}-label`}
                    />
                  </Field>
                  <Field label="Operator">
                    <Controller
                      control={control}
                      render={({ field: { onChange, ref, ...field } }) => (
                        <Select
                          {...field}
                          onChange={(value) => onChange(value.value)}
                          className={styles.matcherOptions}
                          options={matcherFieldOptions}
                          aria-label="operator"
                          id={`matcher-${index}-operator`}
                        />
                      )}
                      defaultValue={matcher.operator || matcherFieldOptions[0].value}
                      name={`matchers.${index}.operator`}
                      rules={{ required: { value: required, message: 'Required.' } }}
                    />
                  </Field>
                  <Field
                    label="Value"
                    invalid={!!errors?.matchers?.[index]?.value}
                    error={errors?.matchers?.[index]?.value?.message}
                  >
                    <Input
                      {...register(`matchers.${index}.value` as const, {
                        required: { value: required, message: 'Required.' },
                      })}
                      defaultValue={matcher.value}
                      placeholder="value"
                      id={`matcher-${index}-value`}
                    />
                  </Field>
                  {(matchers.length > 1 || !required) && (
                    <IconButton
                      aria-label="Remove matcher"
                      className={styles.removeButton}
                      name="trash-alt"
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
            className={styles.indent}
            tooltip="Refine which alert instances are silenced by selecting label matchers"
            type="button"
            icon="plus"
            variant="secondary"
            onClick={() => {
              const newMatcher = { name: '', value: '', operator: MatcherOperator.equal };
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
    wrapper: css({
      marginTop: theme.spacing(2),
    }),
    row: css({
      marginTop: theme.spacing(1),
      display: 'flex',
      alignItems: 'flex-start',
      flexDirection: 'row',
      backgroundColor: theme.colors.background.secondary,
      padding: `${theme.spacing(1)} ${theme.spacing(1)} 0 ${theme.spacing(1)}`,
      '& > * + *': {
        marginLeft: theme.spacing(2),
      },
    }),
    removeButton: css({
      marginLeft: theme.spacing(1),
      marginTop: theme.spacing(2.5),
    }),
    matcherOptions: css({
      minWidth: '140px',
    }),
    matchers: css({
      maxWidth: `${theme.breakpoints.values.sm}px`,
      margin: `${theme.spacing(1)} 0`,
      paddingTop: theme.spacing(0.5),
    }),
    indent: css({
      marginLeft: theme.spacing(2),
    }),
  };
};

export default MatchersField;
