import { useMemo } from 'react';

import { type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { EmbeddedScene, type SceneFlexItem, SceneFlexLayout, SceneTimeRange } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { getGrafanaInstancesByStateScene } from '../../insights/grafana/AlertsByStateScene';
import { getGrafanaEvalSuccessVsFailuresScene } from '../../insights/grafana/EvalSuccessVsFailuresScene';
import { getGrafanaMissedIterationsScene } from '../../insights/grafana/MissedIterationsScene';
import { getGrafanaRulesByEvaluationScene } from '../../insights/grafana/RulesByEvaluation';
import { getAlertsByStateScene } from '../../insights/grafana/alertmanager/AlertsByState';
import { getGrafanaAlertmanagerSilencesScene } from '../../insights/grafana/alertmanager/SilencesByStateScene';

import { toSceneRange } from './homeRange';

const USAGE_DATA_SOURCE: DataSourceRef = { type: 'prometheus', uid: 'grafanacloud-usage' };

/** Charts reused from Insights; they query Grafana Cloud usage metrics for the selected range. */
export function RuleEvaluationCharts({ range }: { range: TimeRange }) {
  const scene = useMemo(
    () =>
      chartsScene(
        [
          getGrafanaInstancesByStateScene(
            USAGE_DATA_SOURCE,
            t('alerting.home.details.instances-over-time', 'Alert instances over time')
          ),
          getGrafanaRulesByEvaluationScene(
            USAGE_DATA_SOURCE,
            t('alerting.home.details.rules-evaluating', 'Rules evaluating')
          ),
          getGrafanaEvalSuccessVsFailuresScene(
            USAGE_DATA_SOURCE,
            t('alerting.home.details.evaluation-success', 'Evaluation success vs failures')
          ),
          getGrafanaMissedIterationsScene(
            USAGE_DATA_SOURCE,
            t('alerting.home.details.missed-evaluations', 'Missed evaluations per rule')
          ),
        ],
        range
      ),
    [range]
  );
  return <scene.Component model={scene} />;
}

export function NotificationCharts({ range }: { range: TimeRange }) {
  const scene = useMemo(
    () =>
      chartsScene(
        [
          getAlertsByStateScene(
            USAGE_DATA_SOURCE,
            t('alerting.home.details.alertmanager-alerts', 'Alerts in the Alertmanager by state')
          ),
          getGrafanaAlertmanagerSilencesScene(USAGE_DATA_SOURCE, t('alerting.home.details.silences', 'Silences')),
        ],
        range
      ),
    [range]
  );
  return <scene.Component model={scene} />;
}

function chartsScene(panels: SceneFlexItem[], range: TimeRange) {
  return new EmbeddedScene({
    $timeRange: new SceneTimeRange(toSceneRange(range)),
    body: new SceneFlexLayout({ wrap: 'wrap', children: panels }),
  });
}
