import { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  EmbeddedScene,
  NestedScene,
  QueryVariable,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneReactObject,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';

import { config } from '../../../../core/config';
import { SectionFooter } from '../insights/SectionFooter';
import { SectionSubheader } from '../insights/SectionSubheader';
import { getActiveGrafanaAlertsScene } from '../insights/grafana/Active';
import { getGrafanaInstancesByStateScene } from '../insights/grafana/AlertsByStateScene';
import { getGrafanaEvalSuccessVsFailuresScene } from '../insights/grafana/EvalSuccessVsFailuresScene';
import { getInstanceStatByStatusScene } from '../insights/grafana/InstanceStatusScene';
import { getGrafanaMissedIterationsScene } from '../insights/grafana/MissedIterationsScene';
import { getMostFiredInstancesScene } from '../insights/grafana/MostFiredInstancesTable';
import { getPausedGrafanaAlertsScene } from '../insights/grafana/Paused';
import { getGrafanaRulesByEvaluationScene } from '../insights/grafana/RulesByEvaluation';
import { getGrafanaRulesByEvaluationPercentageScene } from '../insights/grafana/RulesByEvaluationPercentage';
import { getAlertsByStateScene as getGrafanaAlertsByStateScene } from '../insights/grafana/alertmanager/AlertsByState';
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
import { getMostFiredRulesScene } from '../insights/mimir/rules/MostFiredRules';
import { getPendingCloudAlertsScene } from '../insights/mimir/rules/Pending';

export interface DataSourceInformation {
  type: string;
  uid: string;
  settings: DataSourceInstanceSettings<DataSourceJsonData> | undefined;
}
const ashDs: DataSourceInformation = {
  type: 'loki',
  uid: 'grafanacloud-alert-state-history',
  settings: undefined,
};

const cloudUsageDs: DataSourceInformation = {
  type: 'prometheus',
  uid: 'grafanacloud-usage',
  settings: undefined,
};

const grafanaCloudPromDs: DataSourceInformation = {
  type: 'prometheus',
  uid: 'grafanacloud-prom',
  settings: undefined,
};

const SERIES_COLORS = {
  alerting: 'red',
  firing: 'red',
  active: 'red',
  missed: 'red',
  failed: 'red',
  pending: 'yellow',
  nodata: 'blue',
  'active evaluation': 'blue',
  normal: 'green',
  success: 'green',
  error: 'orange',
};

export function overrideToFixedColor(key: keyof typeof SERIES_COLORS) {
  return {
    mode: 'fixed',
    fixedColor: SERIES_COLORS[key],
  };
}

export const PANEL_STYLES = { minHeight: 300 };

const THIS_WEEK_TIME_RANGE = new SceneTimeRange({ from: 'now-1w', to: 'now' });

const namespace = config.bootData.settings.namespace;

export const INSTANCE_ID = namespace.includes('stack-') ? namespace.replace('stack-', '') : undefined;

const getInsightsDataSources = () => {
  const dataSourceSrv = getDataSourceSrv();

  [ashDs, cloudUsageDs, grafanaCloudPromDs].forEach((ds) => {
    ds.settings = dataSourceSrv.getInstanceSettings(ds.uid);
  });
  return [ashDs, cloudUsageDs, grafanaCloudPromDs];
};

export const insightsIsAvailable = () => {
  const [_, cloudUsageDs, __] = getInsightsDataSources();
  return cloudUsageDs.settings;
};

export function getInsightsScenes() {
  const [ashDs, cloudUsageDs, grafanaCloudPromDs] = getInsightsDataSources();

  const categories = [];

  const showGrafanaManaged = ashDs.settings && cloudUsageDs.settings;
  const showGrafanaAlertmanager = Boolean(cloudUsageDs.settings);
  const showMimirAlertmanager = Boolean(cloudUsageDs.settings);
  const showMimirManaged = cloudUsageDs.settings && grafanaCloudPromDs.settings;
  const showMimirManagedPerGroup = Boolean(cloudUsageDs.settings);

  if (showGrafanaManaged) {
    categories.push(
      new SceneFlexItem({
        ySizing: 'content',
        body: getGrafanaManagedScenes(),
      })
    );
  }

  if (showGrafanaAlertmanager) {
    categories.push(
      new SceneFlexItem({
        ySizing: 'content',
        body: getGrafanaAlertmanagerScenes(),
      })
    );
  }

  if (showMimirManaged) {
    categories.push(
      new SceneFlexItem({
        ySizing: 'content',
        body: getMimirManagedRulesScenes(),
      })
    );
  }

  if (showMimirManagedPerGroup) {
    categories.push(
      new SceneFlexItem({
        ySizing: 'content',
        body: getMimirManagedRulesPerGroupScenes(),
      })
    );
  }

  if (showMimirAlertmanager) {
    categories.push(
      new SceneFlexItem({
        ySizing: 'content',
        body: getCloudScenes(),
      })
    );
  }

  return new EmbeddedScene({
    $timeRange: THIS_WEEK_TIME_RANGE,
    controls: [
      new SceneReactObject({
        component: SectionSubheader,
        props: { children: <div>Monitor the status of your system.</div> },
      }),
      new SceneControlsSpacer(),
      new SceneTimePicker({}),
      new SceneRefreshPicker({}),
    ],
    body: new SceneFlexLayout({
      direction: 'column',
      children: categories,
    }),
  });
}

function getGrafanaManagedScenes() {
  return new NestedScene({
    title: 'Grafana-managed alert rules',
    canCollapse: true,
    isCollapsed: false,
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexLayout({
              children: [
                getMostFiredInstancesScene(ashDs, 'Top 10 firing instances'),
                getActiveGrafanaAlertsScene(cloudUsageDs, 'Active rules'),
                getPausedGrafanaAlertsScene(cloudUsageDs, 'Paused rules'),
              ],
            }),
            new SceneFlexLayout({
              children: [
                getGrafanaInstancesByStateScene(cloudUsageDs, 'Alert instances by state'),
                new SceneFlexLayout({
                  height: '400px',
                  direction: 'column',
                  children: [
                    new SceneFlexLayout({
                      height: '400px',
                      children: [
                        getInstanceStatByStatusScene(
                          cloudUsageDs,
                          'Firing instances',
                          'The number of currently firing alert rule instances',
                          'alerting'
                        ),
                        getInstanceStatByStatusScene(
                          cloudUsageDs,
                          'Pending instances',
                          'The number of currently pending alert rule instances',
                          'pending'
                        ),
                      ],
                    }),
                    new SceneFlexLayout({
                      children: [
                        getInstanceStatByStatusScene(
                          cloudUsageDs,
                          'No data instances',
                          'The current number of alert rule instances in No data state',
                          'nodata'
                        ),
                        getInstanceStatByStatusScene(
                          cloudUsageDs,
                          'Error instances',
                          'The current number of alert rule instances in Error state',
                          'error'
                        ),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            new SceneFlexLayout({
              children: [
                getGrafanaRulesByEvaluationScene(cloudUsageDs, 'Alert rule evaluation'),
                getGrafanaRulesByEvaluationPercentageScene(cloudUsageDs, '% of alert rule evaluation'),
              ],
            }),
            new SceneFlexLayout({
              children: [
                getGrafanaEvalSuccessVsFailuresScene(cloudUsageDs, 'Evaluation success vs failures'),
                getGrafanaMissedIterationsScene(cloudUsageDs, 'Iterations missed per evaluation group'),
              ],
            }),
          ],
        }),
        new SceneReactObject({
          component: SectionFooter,
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
            getGrafanaAlertsByStateScene(cloudUsageDs, 'Firing alerts by state'),
            // getGrafanaAlertmanagerNotificationsScene(cloudUsageDs, 'Notification delivery'),
            getGrafanaAlertmanagerSilencesScene(cloudUsageDs, 'Silences'),
          ],
        }),
        new SceneReactObject({
          component: SectionFooter,
        }),
      ],
    }),
  });
}

function getCloudScenes() {
  return new NestedScene({
    title: 'Mimir Alertmanager',
    canCollapse: true,
    isCollapsed: false,
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          body: new SceneReactObject({
            component: SectionSubheader,
            props: { datasources: [cloudUsageDs] },
          }),
        }),
        new SceneFlexLayout({
          children: [
            getAlertsByStateScene(cloudUsageDs, 'Firing alerts by state'),
            getNotificationsScene(cloudUsageDs, 'Notification delivery'),
          ],
        }),
        new SceneFlexLayout({
          children: [
            getSilencesScene(cloudUsageDs, 'Silences'),
            getInvalidConfigScene(cloudUsageDs, 'Invalid configuration'),
          ],
        }),
        new SceneReactObject({
          component: SectionFooter,
        }),
      ],
    }),
  });
}

function getMimirManagedRulesScenes() {
  return new NestedScene({
    title: 'Mimir-managed alert rules',
    canCollapse: true,
    isCollapsed: false,
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          body: new SceneReactObject({
            component: SectionSubheader,
            props: { datasources: [grafanaCloudPromDs, cloudUsageDs] },
          }),
        }),
        new SceneFlexLayout({
          children: [
            getMostFiredRulesScene(grafanaCloudPromDs, 'Top 10 firing rules'),
            getFiringCloudAlertsScene(grafanaCloudPromDs, 'Firing instances'),
            getPendingCloudAlertsScene(grafanaCloudPromDs, 'Pending instances'),
          ],
        }),
        new SceneFlexLayout({
          children: [
            getInstancesByStateScene(grafanaCloudPromDs, 'Firing and pending alert instances'),
            getInstancesPercentageByStateScene(grafanaCloudPromDs, '% of alert instances by state'),
          ],
        }),
        new SceneFlexLayout({
          children: [
            getEvalSuccessVsFailuresScene(cloudUsageDs, 'Evaluation success vs failures'),
            getMissedIterationsScene(cloudUsageDs, 'Missed evaluations'),
          ],
        }),
        new SceneReactObject({
          component: SectionFooter,
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
    title: 'Mimir-managed alert rules - per rule group',
    canCollapse: true,
    isCollapsed: false,
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          body: new SceneReactObject({
            component: SectionSubheader,
            props: { datasources: [cloudUsageDs] },
          }),
        }),
        new SceneFlexLayout({
          children: [
            getRuleGroupEvaluationsScene(cloudUsageDs, 'Rule group evaluation'),
            getRuleGroupIntervalScene(cloudUsageDs, 'Rule group interval'),
          ],
        }),
        new SceneFlexLayout({
          children: [
            getRuleGroupEvaluationDurationScene(cloudUsageDs, 'Rule group evaluation duration'),
            getRulesPerGroupScene(cloudUsageDs, 'Rules per group'),
            getRuleGroupEvaluationDurationIntervalRatioScene(cloudUsageDs, 'Evaluation duration / interval ratio'),
          ],
        }),
        new SceneReactObject({
          component: SectionFooter,
        }),
      ],
    }),
    $variables: new SceneVariableSet({
      variables: [ruleGroupHandler],
    }),
    controls: [new VariableValueSelectors({})],
  });
}
