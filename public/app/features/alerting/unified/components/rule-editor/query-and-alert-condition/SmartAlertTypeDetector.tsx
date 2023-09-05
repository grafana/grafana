import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { DataSourceJsonData } from '@grafana/schema';
import { Alert, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { AccessControlAction } from 'app/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { NeedHelpInfo } from '../NeedHelpInfo';

function getAvailableRuleTypes() {
  const canCreateGrafanaRules = contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate);
  const canCreateCloudRules = contextSrv.hasPermission(AccessControlAction.AlertingRuleExternalWrite);
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

  //let's check if we switch to cloud type
  const canSwitchToCloudRule =
    !editingExistingRule &&
    !isRecordingRuleType &&
    onlyOneDS &&
    rulesSourcesWithRuler.some((dsJsonData) => dsJsonData.uid === dataSourceIdFromQueries);

  const canSwitchToGrafanaRule = !editingExistingRule && !isRecordingRuleType;
  // check for enabled types
  const grafanaTypeEnabled = availableRuleTypes.enabledRuleTypes.includes(RuleFormType.grafana);
  const cloudTypeEnabled = availableRuleTypes.enabledRuleTypes.includes(RuleFormType.cloudAlerting);

  // can we switch to the other type? (cloud or grafana)
  const canSwitchFromCloudToGrafana =
    ruleFormType === RuleFormType.cloudAlerting && grafanaTypeEnabled && canSwitchToGrafanaRule;
  const canSwitchFromGrafanaToCloud =
    ruleFormType === RuleFormType.grafana && canSwitchToCloudRule && cloudTypeEnabled && canSwitchToCloudRule;

  return canSwitchFromCloudToGrafana || canSwitchFromGrafanaToCloud;
};

export interface SmartAlertTypeDetectorProps {
  editingExistingRule: boolean;
  rulesSourcesWithRuler: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  queries: AlertQuery[];
  onClickSwitch: () => void;
}

const getContentText = (ruleFormType: RuleFormType, isEditing: boolean, dataSourceName: string, canSwitch: boolean) => {
  if (isEditing) {
    if (ruleFormType === RuleFormType.grafana) {
      return {
        contentText: `Grafana-managed alert rules allow you to create alerts that can act on data from any of our supported data sources, including having multiple data sources in the same rule. You can also add expressions to transform your data and set alert conditions. Using images in alert notifications is also supported. `,
        title: `This alert rule is managed by Grafana.`,
      };
    } else {
      return {
        contentText: `Data source-managed alert rules can be used for Grafana Mimir or Grafana Loki data sources which have been configured to support rule creation. The use of expressions or multiple queries is not supported.`,
        title: `This alert rule is managed by the data source ${dataSourceName}.`,
      };
    }
  }
  if (canSwitch) {
    if (ruleFormType === RuleFormType.cloudAlerting) {
      return {
        contentText:
          'Data source-managed alert rules can be used for Grafana Mimir or Grafana Loki data sources which have been configured to support rule creation. The use of expressions or multiple queries is not supported.',
        title: `This alert rule is managed by the data source ${dataSourceName}. If you want to use expressions or have multiple queries, switch to a Grafana-managed alert rule.`,
      };
    } else {
      return {
        contentText:
          'Grafana-managed alert rules allow you to create alerts that can act on data from any of our supported data sources, including having multiple data sources in the same rule. You can also add expressions to transform your data and set alert conditions. Using images in alert notifications is also supported.',
        title: `This alert rule will be managed by Grafana. The selected data source is configured to support rule creation.`,
      };
    }
  } else {
    // it can be only grafana rule
    return {
      contentText: `Grafana-managed alert rules allow you to create alerts that can act on data from any of our supported data sources, including having multiple data sources in the same rule. You can also add expressions to transform your data and set alert conditions. Using images in alert notifications is also supported.`,
      title: `Based on the data sources selected, this alert rule is managed by Grafana.`,
    };
  }
};

export function SmartAlertTypeDetector({
  editingExistingRule,
  rulesSourcesWithRuler,
  queries,
  onClickSwitch,
}: SmartAlertTypeDetectorProps) {
  const { getValues } = useFormContext<RuleFormValues>();

  const [ruleFormType, dataSourceName] = getValues(['type', 'dataSourceName']);
  const styles = useStyles2(getStyles);

  const canSwitch = getCanSwitch({ queries, ruleFormType, editingExistingRule, rulesSourcesWithRuler });

  const typeTitle =
    ruleFormType === RuleFormType.cloudAlerting ? 'Data source-managed alert rule' : 'Grafana-managed alert rule';
  const switchToLabel = ruleFormType !== RuleFormType.cloudAlerting ? 'data source-managed' : 'Grafana-managed';

  const content = ruleFormType
    ? getContentText(ruleFormType, editingExistingRule, dataSourceName ?? '', canSwitch)
    : undefined;

  return (
    <div className={styles.alert}>
      <Alert
        severity="info"
        title={typeTitle}
        onRemove={canSwitch ? onClickSwitch : undefined}
        buttonContent={`Switch to ${switchToLabel} alert rule`}
      >
        <Stack gap={0.5} direction="row" alignItems={'baseline'}>
          <div className={styles.alertText}>{content?.title}</div>
          <div className={styles.needInfo}>
            <NeedHelpInfo
              contentText={content?.contentText ?? ''}
              externalLink={`https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/alert-rule-types/`}
              linkText={`Read about alert rule types`}
              title=" Alert rule types"
            />
          </div>
        </Stack>
      </Alert>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  alertText: css`
    max-width: fit-content;
    flex: 1;
  `,
  alert: css`
    margin-top: ${theme.spacing(2)};
  `,
  needInfo: css`
    flex: 1;
    max-width: fit-content;
  `,
});
