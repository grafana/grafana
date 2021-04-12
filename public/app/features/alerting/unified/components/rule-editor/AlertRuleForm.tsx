import React, { FC } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { PageToolbar, ToolbarButton, useStyles, CustomScrollbar } from '@grafana/ui';
import { css } from '@emotion/css';

import { AlertTypeStep } from './AlertTypeStep';
import { ConditionsStep } from './ConditionsStep';
import { DetailsStep } from './DetailsStep';
import { QueryStep } from './QueryStep';
import { useForm, FormContext } from 'react-hook-form';

//import { fetchRulerRulesNamespace, setRulerRuleGroup } from '../../api/ruler';
import { GrafanaAlertState /*, RulerRuleDTO, RulerRuleGroupDTO */ } from 'app/types/unified-alerting-dto';
//import { locationService } from '@grafana/runtime';
import { RuleFormValues } from '../../types/rule-form';
import { SAMPLE_QUERIES } from '../../mocks/grafana-queries';

type Props = {};

const defaultValues: RuleFormValues = Object.freeze({
  name: '',
  labels: [{ key: '', value: '' }],
  annotations: [{ key: '', value: '' }],
  dataSourceName: null,

  // threshold
  queries: SAMPLE_QUERIES, // @TODO remove the sample eventually
  condition: '',
  noDataState: GrafanaAlertState.NoData,
  execErrState: GrafanaAlertState.Alerting,
  evaluateEvery: '1m',
  evaluateFor: '5m',

  // system
  expression: '',
  forTime: 1,
  forTimeUnit: 'm',
});

export const AlertRuleForm: FC<Props> = () => {
  const styles = useStyles(getStyles);

  const formAPI = useForm<RuleFormValues>({
    mode: 'onSubmit',
    defaultValues,
  });

  const { handleSubmit, watch } = formAPI;

  const values = watch();

  console.log('values', values);

  const showStep2 = Boolean(values.dataSourceName && values.type);

  const onSubmit = (alertRule: RuleFormValues) => {
    console.log('submit', alertRule);
    /*const { name, expression, forTime, dataSourceName, forTimeUnit, labels, annotations, location } = alertRule;
    if (location && expression && dataSourceName && name) {
      const { namespace, group } = location;
      fetchRulerRulesNamespace(dataSourceName, namespace)
        .then((ruleGroup) => {
          const existingGroup: RulerRuleGroupDTO = ruleGroup.find(({ name }) => name === group) || {
            name: group,
            rules: [] as RulerRuleDTO[],
          };
          const alertRule: RulerRuleDTO = {
            alert: name,
            expr: expression,
            for: `${forTime}${forTimeUnit}`,
            labels: labels.reduce((acc, { key, value }) => {
              if (key && value) {
                acc[key] = value;
              }
              return acc;
            }, {} as Record<string, string>),
            annotations: annotations.reduce((acc, { key, value }) => {
              if (key && value) {
                acc[key] = value;
              }
              return acc;
            }, {} as Record<string, string>),
          };

          return setRulerRuleGroup(dataSourceName, namespace, {
            ...existingGroup,
            rules: existingGroup.rules.concat(alertRule),
          });
        })
        .then(() => {
          console.log('Alert rule saved successfully');
          locationService.push('/alerting/list');
        })
        .catch((error) => console.error(error));
    }
    */
  };
  return (
    <FormContext {...formAPI}>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <PageToolbar title="Create alert rule" pageIcon="bell" className={styles.toolbar}>
          <ToolbarButton variant="default">Cancel</ToolbarButton>
          <ToolbarButton variant="primary" type="submit">
            Save
          </ToolbarButton>
          <ToolbarButton variant="primary">Save and exit</ToolbarButton>
        </PageToolbar>
        <div className={styles.contentOutter}>
          <CustomScrollbar autoHeightMin="100%">
            <div className={styles.contentInner}>
              <AlertTypeStep />
              {showStep2 && (
                <>
                  <QueryStep />
                  <ConditionsStep />
                  <DetailsStep />
                </>
              )}
            </div>
          </CustomScrollbar>
        </div>
      </form>
    </FormContext>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    toolbar: css`
      padding-top: ${theme.spacing.sm};
      padding-bottom: ${theme.spacing.md};
      border-bottom: solid 1px ${theme.colors.border2};
    `,
    form: css`
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    `,
    contentInner: css`
      flex: 1;
      padding: ${theme.spacing.md};
    `,
    contentOutter: css`
      background: ${theme.colors.panelBg};
      overflow: hidden;
      flex: 1;
    `,
    formInput: css`
      width: 400px;
      & + & {
        margin-left: ${theme.spacing.sm};
      }
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    `,
  };
};
