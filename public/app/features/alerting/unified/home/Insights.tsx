
import {
  EmbeddedScene,
  NestedScene,
  QueryVariable,
  SceneFlexItem,
  SceneFlexLayout,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';

import { getGrafanaEvalDurationScene } from '../insights/grafana/EvalDurationScene';
import { getGrafanaEvalSuccessVsFailuresScene } from '../insights/grafana/EvalSuccessVsFailuresScene';
import { getFiringGrafanaAlertsScene } from '../insights/grafana/Firing';
import { getGrafanaInstancesByStateScene } from '../insights/grafana/InstancesByState';
import { getGrafanaInstancesPercentageByStateScene } from '../insights/grafana/InstancesPercentageByState';
import { getGrafanaMissedIterationsScene } from '../insights/grafana/MissedIterationsScene';
import { getMostFiredInstancesScene } from '../insights/grafana/MostFiredInstancesTable';
import { getPausedGrafanaAlertsScene } from '../insights/grafana/Paused';
import { getGrafanaAlertmanagerInstancesByStateScene } from '../insights/grafana/alertmanager/AlertsByStateScene';
import { getGrafanaAlertmanagerNotificationsScene } from '../insights/grafana/alertmanager/NotificationsScene';
import { getGrafanaAlertmanagerSilencesScene } from '../insights/grafana/alertmanager/SilencesByStateScene';
import { getAlertsByStateScene } from '../insights/mimir/AlertsByState';
import { getInvalidConfigScene } from '../insights/mimir/InvalidConfig';
import { getNotificationsScene } from '../insights/mimir/Notifications';
import { getSilencesScene } from '../insights/mimir/Silences';
import { getRuleGroupEvaluationDurationIntervalRatioScene } from '../insights/mimir/perGroup/RuleGroupEvaluationDurationIntervalRatioScene';
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

export const PANEL_STYLES = { minHeight: 300 };

const THIS_WEEK_TIME_RANGE = new SceneTimeRange({ from: 'now-1w', to: 'now' });
const LAST_WEEK_TIME_RANGE = new SceneTimeRange({ from: 'now-2w', to: 'now-1w' });

export function getGrafanaScenes() {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexLayout({
          children: [
            getMostFiredInstancesScene(THIS_WEEK_TIME_RANGE, ashDs, 'Top 10 firing instances this week'),
            getFiringGrafanaAlertsScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Active'),
            getPausedGrafanaAlertsScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Paused'),
          ],
        }),
        new SceneFlexLayout({
          children: [
            getGrafanaInstancesByStateScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Count of alert instances by state'),
            getGrafanaInstancesPercentageByStateScene(
              THIS_WEEK_TIME_RANGE,
              cloudUsageDs,
              '% of Alert Instances by State'
            ),
          ],
        }),
        new SceneFlexLayout({
          children: [
            getGrafanaEvalSuccessVsFailuresScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Evaluation success vs failures'),
            getGrafanaMissedIterationsScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Iterations missed'),
          ],
        }),
        new SceneFlexLayout({
          children: [getGrafanaEvalDurationScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Evaluation duration')],
        }),
        new SceneFlexItem({
          ySizing: 'content',
          body: getGrafanaAlertmanagerScenes(),
        }),
        new SceneFlexItem({
          ySizing: 'content',
          body: getCloudScenes(),
        }),
        new SceneFlexItem({
          ySizing: 'content',
          body: getMimirManagedRulesScenes(),
        }),
        new SceneFlexItem({
          ySizing: 'content',
          body: getMimirManagedRulesPerGroupScenes(),
        }),
      ],
    }),
  });
}

function getGrafanaAlertmanagerScenes() {
  return new NestedScene({
    title: 'Grafana Alertmanager',
    canCollapse: true,
    isCollapsed: false,
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexLayout({
          children: [
            getGrafanaAlertmanagerInstancesByStateScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Alerts by state'),
            getGrafanaAlertmanagerNotificationsScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Notifications'),
          ],
        }),
        new SceneFlexLayout({
          children: [getGrafanaAlertmanagerSilencesScene(LAST_WEEK_TIME_RANGE, cloudUsageDs, 'Silences')],
        }),
      ],
    }),
  });
}

function getCloudScenes() {
  return new NestedScene({
    title: 'Mimir alertmanager',
    canCollapse: true,
    isCollapsed: false,
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexLayout({
          children: [
            getAlertsByStateScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Alerts by state'),
            getNotificationsScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Notifications'),
          ],
        }),
        new SceneFlexLayout({
          children: [
            getSilencesScene(LAST_WEEK_TIME_RANGE, cloudUsageDs, 'Silences'),
            getInvalidConfigScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Invalid configuration'),
          ],
        }),
      ],
    }),
  });
}

function getMimirManagedRulesScenes() {
  return new NestedScene({
    title: 'Mimir-managed rules',
    canCollapse: true,
    isCollapsed: false,
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexLayout({
          children: [
            getMostFiredCloudInstances(THIS_WEEK_TIME_RANGE, grafanaCloudPromDs, 'Top 10 firing instance this week'),
            getFiringCloudAlertsScene(THIS_WEEK_TIME_RANGE, grafanaCloudPromDs, 'Active'),
            getPendingCloudAlertsScene(THIS_WEEK_TIME_RANGE, grafanaCloudPromDs, 'Pending'),
          ],
        }),
        new SceneFlexLayout({
          children: [
            getInstancesByStateScene(THIS_WEEK_TIME_RANGE, grafanaCloudPromDs, 'Count of alert instances by state'),
            getInstancesPercentageByStateScene(
              THIS_WEEK_TIME_RANGE,
              grafanaCloudPromDs,
              '% of alert instances by State'
            ),
          ],
        }),
        new SceneFlexLayout({
          children: [
            getEvalSuccessVsFailuresScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Evaluation success vs failures'),
            getMissedIterationsScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Iterations missed'),
          ],
        }),
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

  return new NestedScene({
    title: 'Mimir-managed Rules - Per Rule Group',
    canCollapse: true,
    isCollapsed: false,
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexLayout({
          children: [
            getRuleGroupEvaluationsScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Rule group evaluation'),
            getRuleGroupIntervalScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Rule group interval'),
          ],
        }),
        new SceneFlexLayout({
          children: [
            getRuleGroupEvaluationDurationScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Rule group evaluation duration'),
            getRulesPerGroupScene(THIS_WEEK_TIME_RANGE, cloudUsageDs, 'Rules per group'),
            getRuleGroupEvaluationDurationIntervalRatioScene(
              THIS_WEEK_TIME_RANGE,
              cloudUsageDs,
              'Evaluation duration / interval ratio'
            ),
          ],
        }),
      ],
    }),
    $variables: new SceneVariableSet({
      variables: [ruleGroupHandler],
    }),
    controls: [new VariableValueSelectors({})],
  });
}
