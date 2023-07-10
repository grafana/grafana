import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { DataSourceJsonData } from '@grafana/schema';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { AccessControlAction } from 'app/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { NeedHelpInfo } from '../NeedHelpInfo';

function getAvailableRuleTypes() {
  const canCreateGrafanaRules = contextSrv.hasAccess(
    AccessControlAction.AlertingRuleCreate,
    contextSrv.hasEditPermissionInFolders
  );
  const canCreateCloudRules = contextSrv.hasAccess(AccessControlAction.AlertingRuleExternalWrite, contextSrv.isEditor);
  const defaultRuleType = canCreateGrafanaRules ? RuleFormType.grafana : RuleFormType.cloudAlerting;

  const enabledRuleTypes: RuleFormType[] = [];
  if (canCreateGrafanaRules) {
    enabledRuleTypes.push(RuleFormType.grafana);
  }
  if (canCreateCloudRules) {
    enabledRuleTypes.push(RuleFormType.cloudAlerting, RuleFormType.cloudRecording);
  }

  return { enabledRuleTypes, defaultRuleType };
}

const onlyOneDSInQueries = (queries: AlertQuery[]) => {
  return queries.filter((q) => q.datasourceUid !== ExpressionDatasourceUID).length === 1;
};
const getCanSwitch = ({
  queries,
  ruleFormType,
  editingExistingRule,
  rulesSourcesWithRuler,
}: {
  rulesSourcesWithRuler: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  queries: AlertQuery[];
  ruleFormType: RuleFormType | undefined;
  editingExistingRule: boolean;
}) => {
  // get available rule types
  const availableRuleTypes = getAvailableRuleTypes();

  // check if we have only one query in queries and if it's a cloud datasource
  const onlyOneDS = onlyOneDSInQueries(queries);
  const dataSourceIdFromQueries = queries[0]?.datasourceUid ?? '';
  const isRecordingRuleType = ruleFormType === RuleFormType.cloudRecording;
  // it's a smart type if we are creating a new rule and it's not a recording rule type
  const showSmartTypeSwitch = !editingExistingRule && !isRecordingRuleType;
  //let's check if we have a smart cloud type
  const canBeCloud =
    showSmartTypeSwitch &&
    onlyOneDS &&
    rulesSourcesWithRuler.some(
      (dsJsonData: DataSourceInstanceSettings<DataSourceJsonData>) => dsJsonData.uid === dataSourceIdFromQueries
    );
  // check for enabled types
  const grafanaTypeEnabled = availableRuleTypes.enabledRuleTypes.includes(RuleFormType.grafana);
  const cloudTypeEnabled = availableRuleTypes.enabledRuleTypes.includes(RuleFormType.cloudAlerting);
  // can we switch to the other type? (cloud or grafana)
  const canSwitch =
    !editingExistingRule &&
    !isRecordingRuleType &&
    ((cloudTypeEnabled && canBeCloud && ruleFormType === RuleFormType.grafana) ||
      (ruleFormType === RuleFormType.cloudAlerting && grafanaTypeEnabled));
  return canSwitch;
};

export function SmartAlertTypeDetector({
  editingExistingRule,
  rulesSourcesWithRuler,
  queries,
  removeExpressionsInQueriesReducer,
  addExpressionsInQueries,
  antExpressions,
  setAntExpressions,
}: {
  editingExistingRule: boolean;
  rulesSourcesWithRuler: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  queries: AlertQuery[];
  removeExpressionsInQueriesReducer: () => void;
  addExpressionsInQueries: (expressions: AlertQuery[]) => void;
  antExpressions: AlertQuery[];
  setAntExpressions: (expressions: AlertQuery[]) => void;
}) {
  const { getValues, setValue } = useFormContext<RuleFormValues>();

  const ruleFormType = getValues('type');
  const styles = useStyles2(getStyles);

  const canSwitch = getCanSwitch({ queries, ruleFormType, editingExistingRule, rulesSourcesWithRuler });

  const restoreExpressionsInQueries = useCallback(() => {
    addExpressionsInQueries(antExpressions);
  }, [antExpressions, addExpressionsInQueries]);

  const onClickSwitch = useCallback(() => {
    const typeInForm = getValues('type');
    if (typeInForm === RuleFormType.cloudAlerting) {
      setValue('type', RuleFormType.grafana);
      antExpressions.length > 0 && restoreExpressionsInQueries();
    } else {
      setValue('type', RuleFormType.cloudAlerting);
      const expressions = queries.filter((query) => query.datasourceUid === ExpressionDatasourceUID);
      setAntExpressions(expressions);
      removeExpressionsInQueriesReducer();
    }
  }, [
    getValues,
    setValue,
    queries,
    antExpressions,
    removeExpressionsInQueriesReducer,
    restoreExpressionsInQueries,
    setAntExpressions,
  ]);

  const typeTitle =
    ruleFormType === RuleFormType.cloudAlerting ? 'Data source-managed alert rule' : 'Grafana-managed alert rule';
  const switchToLabel = ruleFormType !== RuleFormType.cloudAlerting ? 'data source-managed' : 'Grafana-managed';
  const contentText =
    ruleFormType === RuleFormType.cloudAlerting
      ? 'Data source-managed alert rules are stored in the data source and are managed by the data source.'
      : 'Grafana-managed alert rules are stored in the Grafana database and are managed by Grafana.';
  const titleLabel =
    ruleFormType === RuleFormType.cloudAlerting
      ? 'This rule is going to be managed by the data source. The use of expressions or multiple queries is not supported. If your data source does not have an Alert manager configured or you wish to use expressions or multiple queries, switch to a Grafana-managed alert.'
      : 'This is a Grafana-managed alert rule. You can switch it to a data source-managed alert rule if you have a Mimir / Loki / Cortex data source configured with an Alert manager.';
  const cantSwitchLabel = `Based on the selected data sources this alert rule will be Grafana-managed.`;
  return (
    <div className={styles.alert}>
      <Alert severity="info" title={typeTitle}>
        <Stack gap={1} direction="row" alignItems={'center'}>
          {!editingExistingRule && !canSwitch && cantSwitchLabel}
          {!editingExistingRule && canSwitch && titleLabel}
          <NeedHelpInfo
            contentText={contentText}
            externalLink={`https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/alert-rule-types/`}
            linkText={`Read about alert rule types`}
            title=" Alert rule types"
          />

          {canSwitch && (
            <Button type="button" onClick={onClickSwitch} variant="secondary" className={styles.switchButton}>
              Switch to {switchToLabel} alert rule
            </Button>
          )}
        </Stack>
      </Alert>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  switchButton: css`
    margin-left: ${theme.spacing(1)};
  `,
  alert: css`
    margin-top: ${theme.spacing(2)};
  `,
});
