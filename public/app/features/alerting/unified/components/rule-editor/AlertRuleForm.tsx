import React, { FC, useState } from 'react';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { PageToolbar, ToolbarButton, Form, FormAPI, useStyles, CustomScrollbar } from '@grafana/ui';
import { css } from '@emotion/css';

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

export const AlertRuleForm: FC<Props> = () => {
  const styles = useStyles(getStyles);

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
      className={styles.form}
      defaultValues={{ labels: [{ key: '', value: '' }], annotations: [{ key: {}, value: '' }] }}
    >
      {(formApi) => (
        <>
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
                <AlertTypeSection {...formApi} setFolder={setFolder} />
                <Expression {...formApi} />
                <AlertConditionsSection {...formApi} />
                <AlertDetails {...formApi} />
              </div>
            </CustomScrollbar>
          </div>
        </>
      )}
    </Form>
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
