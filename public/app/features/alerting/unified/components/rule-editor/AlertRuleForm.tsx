import React, { FC, useState } from 'react';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { PageToolbar, ToolbarButton, stylesFactory, Form, FormAPI } from '@grafana/ui';
import { css } from '@emotion/css';

import { config } from 'app/core/config';
import AlertTypeSection from './AlertTypeSection';
import AlertConditionsSection from './AlertConditionsSection';
import AlertDetails from './AlertDetails';
import Expression from './Expression';

import { fetchRulerRulesNamespace, setRulerRuleGroup } from '../../api/ruler';
import { RulerRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';
import { locationService } from '@grafana/runtime';

type Props = {};

interface AlertRuleFormFields {
  name: string;
  type: SelectableValue;
  folder: SelectableValue;
  forTime: string;
  dataSource: SelectableValue;
  expression: string;
  timeUnit: SelectableValue;
  labels: Array<{ key: string; value: string }>;
  annotations: Array<{ key: SelectableValue; value: string }>;
}

export type AlertRuleFormMethods = FormAPI<AlertRuleFormFields>;

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    fullWidth: css`
      width: 100%;
    `,
    formWrapper: css`
      padding: 0 ${theme.spacing.md};
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
});

const AlertRuleForm: FC<Props> = () => {
  const styles = getStyles(config.theme);

  const [folder, setFolder] = useState<{ namespace: string; group: string }>();

  const handleSubmit = (alertRule: AlertRuleFormFields) => {
    const { name, expression, forTime, dataSource, timeUnit, labels, annotations } = alertRule;
    console.log('saving', alertRule);
    const { namespace, group: groupName } = folder || {};
    if (namespace && groupName) {
      fetchRulerRulesNamespace(dataSource?.value, namespace)
        .then((ruleGroup) => {
          const group: RulerRuleGroupDTO = ruleGroup.find(({ name }) => name === groupName) || {
            name: groupName,
            rules: [] as RulerRuleDTO[],
          };
          const alertRule: RulerRuleDTO = {
            alert: name,
            expr: expression,
            for: `${forTime}${timeUnit.value}`,
            labels: labels.reduce((acc, { key, value }) => {
              if (key && value) {
                acc[key] = value;
              }
              return acc;
            }, {} as Record<string, string>),
            annotations: annotations.reduce((acc, { key, value }) => {
              if (key && value) {
                acc[key.value] = value;
              }
              return acc;
            }, {} as Record<string, string>),
          };

          group.rules = group?.rules.concat(alertRule);
          return setRulerRuleGroup(dataSource?.value, namespace, group);
        })
        .then(() => {
          console.log('Alert rule saved successfully');
          locationService.push('/alerting/list');
        })
        .catch((error) => console.error(error));
    }
  };
  return (
    <Form
      onSubmit={handleSubmit}
      className={styles.fullWidth}
      defaultValues={{ labels: [{ key: '', value: '' }], annotations: [{ key: {}, value: '' }] }}
    >
      {(formApi) => (
        <>
          <PageToolbar title="Create alert rule" pageIcon="bell">
            <ToolbarButton variant="primary" type="submit">
              Save
            </ToolbarButton>
            <ToolbarButton variant="primary">Save and exit</ToolbarButton>
            <a href="/alerting/list">
              <ToolbarButton variant="destructive" type="button">
                Cancel
              </ToolbarButton>
            </a>
          </PageToolbar>
          <div className={styles.formWrapper}>
            <AlertTypeSection {...formApi} setFolder={setFolder} />
            <Expression {...formApi} />
            <AlertConditionsSection {...formApi} />
            <AlertDetails {...formApi} />
          </div>
        </>
      )}
    </Form>
  );
};

export default AlertRuleForm;
