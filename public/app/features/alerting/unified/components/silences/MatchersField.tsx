import { css, cx } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Combobox, ComboboxOption, Divider, Field, IconButton, Input, Stack, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { SilenceFormFields } from '../../types/silence-form';
import { matcherFieldOptions } from '../../utils/alertmanager';
import AlertLabelDropdown from '../AlertLabelDropdown';
import { useGetLabelsFromDataSourceName } from '../rule-editor/useAlertRuleSuggestions';

interface Props {
  required: boolean;
  ruleUid?: string;
}

function mapToOptions(items: Iterable<string> = []): Array<ComboboxOption<string>> {
  return Array.from(items, (item) => ({ label: item, value: item }));
}
const { useGetAlertRuleQuery } = alertRuleApi;

const MatchersField = ({ required, ruleUid }: Props) => {
  const styles = useStyles2(getStyles);
  const formApi = useFormContext<SilenceFormFields>();
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = formApi;

  const { selectedAlertmanager, isGrafanaAlertmanager } = useAlertmanager();

  const matchersWatch = watch('matchers');

  const { labels } = useGetLabelsFromDataSourceName(isGrafanaAlertmanager ? selectedAlertmanager : undefined, true);
  const labelsArray = mapToOptions(Array.from(labels.keys()));
  const { fields: matchers = [], append, remove } = useFieldArray<SilenceFormFields>({ name: 'matchers' });

  const { data: alertRule } = useGetAlertRuleQuery(ruleUid ? { uid: ruleUid } : skipToken);

  return (
    <Field
      label={t('alerting.matchers-field.label-refine-affected-alerts', 'Refine affected alerts')}
      required={required}
    >
      <div>
        <div className={cx(styles.matchers)}>
          {alertRule && (
            <div>
              <Field label={t('alerting.matchers-field.label-alert-rule', 'Alert rule')} disabled>
                <Input id="alert-rule-name" defaultValue={alertRule.grafana_alert.title} disabled />
              </Field>
              <Divider />
            </div>
          )}
          {matchers.map((matcher, index) => {
            return (
              <div className={styles.row} key={`${matcher.id}`} data-testid="matcher">
                <Stack direction="row">
                  <Field
                    label={t('alerting.matchers-field.label-label', 'Label')}
                    invalid={!!errors?.matchers?.[index]?.name}
                    error={errors?.matchers?.[index]?.name?.message}
                  >
                    <Controller
                      name={`matchers.${index}.name`}
                      control={control}
                      rules={{ required: Boolean(matchersWatch.at(index)?.name) ? 'Required.' : false }}
                      render={({ field: { onChange, ref, ...rest } }) => {
                        return (
                          <AlertLabelDropdown
                            {...rest}
                            value={{ label: matchersWatch.at(index)?.name, value: matchersWatch.at(index)?.name || '' }}
                            options={labelsArray}
                            onChange={(newValue) => {
                              onChange(newValue ? newValue.value : '');
                              setValue(`matchers.${index}.value`, '');
                            }}
                            type="key"
                          />
                        );
                      }}
                    />
                  </Field>

                  <Field label={t('alerting.matchers-field.label-operator', 'Operator')}>
                    <Controller
                      control={control}
                      render={({ field: { onChange, ref, ...field } }) => (
                        <Combobox
                          {...field}
                          width={20}
                          onChange={(value) => onChange(value.value)}
                          options={matcherFieldOptions}
                          aria-label={t('alerting.matchers-field.aria-label-operator', 'operator')}
                          id={`matcher-${index}-operator`}
                        />
                      )}
                      defaultValue={matcher.operator || matcherFieldOptions[0].value}
                      name={`matchers.${index}.operator`}
                      rules={{ required: { value: required, message: 'Required.' } }}
                    />
                  </Field>

                  <Field
                    label={t('alerting.matchers-field.label-value', 'Value')}
                    invalid={!!errors?.matchers?.[index]?.value}
                    error={errors?.matchers?.[index]?.value?.message}
                  >
                    <Controller
                      name={`matchers.${index}.value`}
                      control={control}
                      render={({ field: { onChange, ref, ...rest } }) => {
                        const labelValue = matchersWatch.at(index)?.name;
                        const labelValues = labelValue ? labels.get(labelValue) : [];
                        const labelValuesArray = mapToOptions(labelValues);
                        return (
                          <AlertLabelDropdown
                            {...rest}
                            value={matchersWatch.at(index)}
                            options={labelValuesArray}
                            onChange={(newValue) => {
                              onChange(newValue ? newValue.value : '');
                            }}
                            type="value"
                          />
                        );
                      }}
                    />
                  </Field>
                  {(matchers.length > 1 || !required) && (
                    <IconButton
                      aria-label={t('alerting.matchers-field.aria-label-remove-matcher', 'Remove matcher')}
                      name="trash-alt"
                      onClick={() => remove(index)}
                    >
                      <Trans i18nKey="alerting.matchers-field.remove">Remove</Trans>
                    </IconButton>
                  )}
                </Stack>
              </div>
            );
          })}
        </div>
        <Button
          tooltip={t(
            'alerting.matchers-field.tooltip-refine-which-alert-instances-silenced-selecting',
            'Refine which alert instances are silenced by selecting label matchers'
          )}
          type="button"
          icon="plus"
          variant="secondary"
          onClick={() => {
            const newMatcher = { name: '', value: '', operator: MatcherOperator.equal };
            append(newMatcher);
          }}
        >
          <Trans i18nKey="alerting.matchers-field.add-matcher">Add matcher</Trans>
        </Button>
      </div>
    </Field>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    row: css({
      padding: theme.spacing(1, 1, 0, 1),
      backgroundColor: theme.colors.background.secondary,
    }),
    matchers: css({
      margin: theme.spacing(1, 0),
    }),
  };
};

export default MatchersField;
