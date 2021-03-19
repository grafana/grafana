import React, { FC } from 'react';
import { PageToolbar, ToolbarButton, stylesFactory, Form } from '@grafana/ui';

import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { css } from 'emotion';
import { config } from 'app/core/config';
import AlertTypeSection from './components/AlertTypeSection';
import AlertConditionsSection from './components/AlertConditionsSection';
import Expression from './components/Expression';

import { fetchRulerRulesNamespace, setRulerRuleGroup } from './api/ruler';
import { RulerRuleDTO } from 'app/types/unified-alerting/dto';

type Props = {};

interface AlertRuleDTO {
  name: string;
  type: SelectableValue;
  folder: SelectableValue;
  forTime: string;
  datasource: SelectableValue;
  expression: string;
  timeUnit: SelectableValue;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    fullWidth: css`
      width: 100%;
    `,
    formWrapper: css`
      padding: 0 16px;
    `,
    formInput: css`
      width: 400px;
      & + & {
        margin-left: 8px;
      }
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    `,
  };
});

const AlertEditor: FC<Props> = () => {
  const styles = getStyles(config.theme);

  const handleSubmit = (alertRule: AlertRuleDTO) => {
    const { name, expression, forTime, folder, datasource, timeUnit } = alertRule;
    const [namespace, groupName] = folder?.value;
    fetchRulerRulesNamespace(datasource?.value, namespace)
      .then((ruleGroup) => {
        const group = ruleGroup.find(({ name }) => name === groupName) || {
          name: groupName,
          rules: [] as RulerRuleDTO[],
        };
        const alertRule = {
          alert: name,
          expr: expression,
          for: `${forTime}${timeUnit.value}`,
        };

        group.rules = group?.rules.concat(alertRule);

        return setRulerRuleGroup(datasource?.value, namespace, group);
      })
      .then(() => {
        console.log('Alert rule saved successfully');
      })
      .catch((error) => console.error(error));
  };
  return (
    <Form onSubmit={handleSubmit} className={styles.fullWidth}>
      {(formApi) => (
        <>
          <PageToolbar title="Create alert rule" pageIcon="bell">
            <ToolbarButton variant="primary" type="submit">
              Save
            </ToolbarButton>
            <ToolbarButton variant="primary">Save and exit</ToolbarButton>
            <ToolbarButton variant="destructive">Cancel</ToolbarButton>
          </PageToolbar>
          <div className={styles.formWrapper}>
            <AlertTypeSection {...formApi} />
            <Expression {...formApi} />
            <AlertConditionsSection {...formApi} />
            {/* <AlertDetails {...formApi} /> */}
          </div>
        </>
      )}
    </Form>
  );
};

export default AlertEditor;
