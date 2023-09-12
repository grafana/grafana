import React, { useMemo, useState } from 'react';

import {
  EmbeddedScene,
  QueryVariable,
  SceneApp,
  SceneAppPage,
  SceneFlexLayout,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import { usePageNav } from 'app/core/components/Page/usePageNav';
import { PluginPageContext, PluginPageContextType } from 'app/features/plugins/components/PluginPageContext';

import { getFiringAlertsScene } from '../insights/grafana/FiringAlertsPercentage';
import { getFiringAlertsRateScene } from '../insights/grafana/FiringAlertsRate';
import { getMostFiredInstancesScene } from '../insights/grafana/MostFiredInstancesTable';
import { getAlertsByStateScene } from '../insights/mimir/AlertsByState';
import { getInvalidConfigScene } from '../insights/mimir/InvalidConfig';
import { getNotificationsScene } from '../insights/mimir/Notifications';
import { getSilencesScene } from '../insights/mimir/Silences';
import { getRuleGroupEvaluationDurationScene } from '../insights/mimir/perGroup/RuleGroupEvaluationDurationScene';
import { getRuleGroupEvaluationsScene } from '../insights/mimir/perGroup/RuleGroupEvaluationsScene';
import { getRuleGroupIntervalScene } from '../insights/mimir/perGroup/RuleGroupIntervalScene';
import { getRulesPerGroupScene } from '../insights/mimir/perGroup/RulesPerGroupScene';
import { getEvalSuccessVsFailuresScene } from '../insights/mimir/rules/EvalSuccessVsFailuresScene';
import { getFiringCloudAlertsScene } from '../insights/mimir/rules/Firing';
import { getInstancesByStateScene } from '../insights/mimir/rules/InstancesByState';
import { getInstancesPercentageByStateScene } from '../insights/mimir/rules/InstancesPercentageByState';
import { getMissedIterationsScene } from '../insights/mimir/rules/MissedIterationsScene';
import { getMostFiredInstancesScene as getMostFiredCloudInstances } from '../insights/mimir/rules/MostFiredInstances';
import { getPendingCloudAlertsScene } from '../insights/mimir/rules/Pending';


const ashDs = {
  type: 'loki',
  uid: 'grafanacloud-alert-state-history',
};

const cloudUsageDs = {
  type: 'prometheus',
  uid: 'grafanacloud-usage',
};

const grafanaCloudPromDs = {
  type: 'prometheus',
  uid: 'grafanacloud-prom',
};

const THIS_WEEK_TIME_RANGE = new SceneTimeRange({ from: 'now-1w', to: 'now' });
const LAST_WEEK_TIME_RANGE = new SceneTimeRange({ from: 'now-2w', to: 'now-1w' });

function getGrafanaScenes() {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      wrap: 'wrap',
      children: [
        getMostFiredInstancesScene(THIS_WEEK_TIME_RANGE, ashDs, 'Top 10 firing instances this week'),

        getFiringAlertsRateScene(THIS_WEEK_TIME_RANGE, ashDs, 'Alerts firing per minute'),

        getFiringAlertsScene(THIS_WEEK_TIME_RANGE, ashDs, 'Firing alerts this week'),

        getFiringAlertsScene(LAST_WEEK_TIME_RANGE, ashDs, 'Firing alerts last week'),
      ],
    }),
  });
}

function getCloudScenes() {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      wrap: 'wrap',
      children: [
        getAlertsByStateScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Alerts by State'),
        getNotificationsScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Notifications'),

        getSilencesScene(LAST_WEEK_TIME_RANGE, cloudUsageDs, 'Silences'),
        getInvalidConfigScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Invalid configuration'),
      ],
    }),
  });
}

function getMimirManagedRulesScenes() {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      wrap: 'wrap',
      children: [
        getMostFiredCloudInstances(THIS_WEEK_TIME_RANGE, grafanaCloudPromDs, 'Top 10 firing instance this week'),
        getFiringCloudAlertsScene(THIS_WEEK_TIME_RANGE, grafanaCloudPromDs, 'Firing'),
        getPendingCloudAlertsScene(THIS_WEEK_TIME_RANGE, grafanaCloudPromDs, 'Pending'),

        getInstancesByStateScene(THIS_WEEK_TIME_RANGE, grafanaCloudPromDs, 'Count of alert instances by state'),
        getInstancesPercentageByStateScene(THIS_WEEK_TIME_RANGE, grafanaCloudPromDs, '% of Alert Instances by State'),

        getEvalSuccessVsFailuresScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Evaluation Success vs Failures'),
        getMissedIterationsScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Iterations Missed'),
      ],
    }),
  });
}

function getMimirManagedRulesPerGroupScenes() {
  const ruleGroupHandler = new QueryVariable({
    label: 'Rule Group',
    name: 'rule_group',
    datasource: cloudUsageDs,
    query: 'label_values(grafanacloud_instance_rule_group_rules,rule_group)',
  });

  return new EmbeddedScene({
    body: new SceneFlexLayout({
      wrap: 'wrap',
      children: [
        getRuleGroupEvaluationsScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Rule Group Evaluation'),
        getRuleGroupIntervalScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Rule Group Interval'),
        getRuleGroupEvaluationDurationScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Rule Group Evaluation Duration'),
        getRulesPerGroupScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Rules per Group'),
      ],
    }),
    $variables: new SceneVariableSet({
      variables: [ruleGroupHandler],
    }),
    controls: [new VariableValueSelectors({})],
  });
}

export function getMainPageScene() {
  return new SceneAppPage({
    title: 'Alerting Insights',
    subTitle: 'Monitor the status of your alerts',
    url: '/alerting',
    hideFromBreadcrumbs: true,
    getScene: getGrafanaScenes,
    tabs: [
      new SceneAppPage({
        title: 'Grafana',
        url: '/alerting/insights',
        getScene: getGrafanaScenes,
      }),
      new SceneAppPage({
        title: 'Mimir alertmanager',
        url: '/alerting/insights/mimir-alertmanager',
        getScene: getCloudScenes,
      }),
      new SceneAppPage({
        title: 'Mimir-managed rules',
        url: '/alerting/insights/mimir-rules',
        getScene: getMimirManagedRulesScenes,
      }),
      new SceneAppPage({
        title: 'Mimir-managed Rules - Per Rule Group',
        url: '/alerting/insights/mimir-rules-per-group',
        getScene: getMimirManagedRulesPerGroupScenes,
      }),
    ],
  });
}

export default function Insights() {
  const appScene = useMemo(
    () =>
      new SceneApp({
        pages: [getMainPageScene()],
      }),
    []
  );

  const sectionNav = usePageNav('alerting')!;
  const [pluginContext] = useState<PluginPageContextType>({ sectionNav });

  return (
    <PluginPageContext.Provider value={pluginContext}>
      <appScene.Component model={appScene} />
    </PluginPageContext.Provider>
  );
}
