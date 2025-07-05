import { PluginExtensionAddedLinkConfig } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { log } from 'app/features/plugins/extensions/logs/log';
import { createAddedLinkConfig } from 'app/features/plugins/extensions/utils';

// TODO: Add other scenes drilldownapps here
export const metricsDrilldownPluginId = 'grafana-metricsdrilldown-app';
export const extensionPointId = `${metricsDrilldownPluginId}/alerting/alertingrule/queryeditor/v1`;

export type MetricsDrilldownExternsionAlertingRuleContext = {
  targets: RuleFormValues;
};

export function getAlertingExtensionConfigs(): PluginExtensionAddedLinkConfig[] {
  try {
    return [
      createAddedLinkConfig<MetricsDrilldownExternsionAlertingRuleContext>({
        // This is called at the top level, so will break if we add a translation here 😱
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        title: 'Navigate to Alert rule form',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        description: 'Return to the alert rule form.',
        targets: [extensionPointId],
        icon: 'apps',
        category: 'Alerting',
        onClick: (_, { context }) => {
          if (!context) {
            console.warn('Extension context is undefined');
            return;
          }

          const url = encodeURL(context.targets);

          locationService.push(url);
        },
      }),
    ];
  } catch (error) {
    log.warning(`Could not configure extensions for Alerting due to: "${error}"`);
    return [];
  }
}

/**
 * Encodes the ruleFormValues into a URL
 * @param ruleFormValues - The ruleFormValues to encode
 * @returns The encoded URL
 */
function encodeURL(ruleFormValues: RuleFormValues) {
  const jsonString = JSON.stringify(ruleFormValues);
  const urlEncodedTargets = encodeURIComponent(jsonString);
  const url = '/alerting/new/alerting?defaults=' + urlEncodedTargets;
  return url;
}

// Saving for tests
// const url = '/alerting/new/alerting?defaults=%7B%22name%22%3A%22Image%20Provider%20Latency%20P50%20Alert%22%2C%22type%22%3A%22grafana%22%2C%22queries%22%3A%5B%7B%22refId%22%3A%22A%22%2C%22queryType%22%3A%22%22%2C%22datasourceUid%22%3A%22fenlcp4kzo4jke%22%2C%22model%22%3A%7B%22refId%22%3A%22A%22%2C%22expr%22%3A%22histogram_quantile(0.5%2C%20sum%20by(le%2C%20cloud_availability_zone)%20(rate(traces_spanmetrics_latency_bucket%7Bjob%3D%5C%22imageprovider%5C%22%7D%5B%24__rate_interval%5D)))%22%2C%22instant%22%3Atrue%2C%22datasource%22%3A%7B%22type%22%3A%22prometheus%22%2C%22uid%22%3A%22fenlcp4kzo4jke%22%7D%7D%2C%22relativeTimeRange%22%3A%7B%22from%22%3A600%2C%22to%22%3A0%7D%7D%2C%7B%22refId%22%3A%22B%22%2C%22queryType%22%3A%22expression%22%2C%22datasourceUid%22%3A%22__expr__%22%2C%22model%22%3A%7B%22refId%22%3A%22B%22%2C%22type%22%3A%22reduce%22%2C%22expression%22%3A%22A%22%2C%22reducer%22%3A%22max%22%2C%22settings%22%3A%7B%22mode%22%3A%22strict%22%7D%7D%7D%2C%7B%22refId%22%3A%22C%22%2C%22queryType%22%3A%22expression%22%2C%22datasourceUid%22%3A%22__expr__%22%2C%22model%22%3A%7B%22refId%22%3A%22C%22%2C%22type%22%3A%22threshold%22%2C%22expression%22%3A%22B%22%2C%22conditions%22%3A%5B%7B%22evaluator%22%3A%7B%22params%22%3A%5B0.5%5D%2C%22type%22%3A%22gt%22%7D%7D%5D%7D%7D%5D%2C%22condition%22%3A%22C%22%7D'
// return {url: '/alerting/new/alerting?defaults=%7B%22name%22%3A%22Image%20Provider%20Latency%20P50%20Alert%22%2C%22type%22%3A%22grafana%22%2C%22queries%22%3A%5B%7B%22refId%22%3A%22A%22%2C%22queryType%22%3A%22%22%2C%22datasourceUid%22%3A%22fenlcp4kzo4jke%22%2C%22model%22%3A%7B%22refId%22%3A%22A%22%2C%22expr%22%3A%22histogram_quantile(0.5%2C%20sum%20by(le%2C%20cloud_availability_zone)%20(rate(traces_spanmetrics_latency_bucket%7Bjob%3D%5C%22imageprovider%5C%22%7D%5B%24__rate_interval%5D)))%22%2C%22instant%22%3Atrue%2C%22datasource%22%3A%7B%22type%22%3A%22prometheus%22%2C%22uid%22%3A%22fenlcp4kzo4jke%22%7D%7D%2C%22relativeTimeRange%22%3A%7B%22from%22%3A600%2C%22to%22%3A0%7D%7D%2C%7B%22refId%22%3A%22B%22%2C%22queryType%22%3A%22expression%22%2C%22datasourceUid%22%3A%22__expr__%22%2C%22model%22%3A%7B%22refId%22%3A%22B%22%2C%22type%22%3A%22reduce%22%2C%22expression%22%3A%22A%22%2C%22reducer%22%3A%22max%22%2C%22settings%22%3A%7B%22mode%22%3A%22strict%22%7D%7D%7D%2C%7B%22refId%22%3A%22C%22%2C%22queryType%22%3A%22expression%22%2C%22datasourceUid%22%3A%22__expr__%22%2C%22model%22%3A%7B%22refId%22%3A%22C%22%2C%22type%22%3A%22threshold%22%2C%22expression%22%3A%22B%22%2C%22conditions%22%3A%5B%7B%22evaluator%22%3A%7B%22params%22%3A%5B0.5%5D%2C%22type%22%3A%22gt%22%7D%7D%5D%7D%7D%5D%2C%22condition%22%3A%22C%22%7D'};
// const url = '/alerting/new/alerting?defaults=' + urlEncodedTargets

// Successfully tested
// const histogramAlert: RuleFormValues = {
//   name: 'Image Provider Latency P50 Alert',
//   queries: [
//     {
//       refId: 'A',
//       queryType: '',
//       datasourceUid: 'fenlcp4kzo4jke',
//       model: {
//         refId: 'A',
//         expr: 'histogram_quantile(0.5, sum by(le, cloud_availability_zone) (rate(traces_spanmetrics_latency_bucket{job="imageprovider"}[$__rate_interval])))',
//         instant: true,
//         datasource: {
//           type: 'prometheus',
//           uid: 'fenlcp4kzo4jke'
//         },
//         interval: '',
//         legendFormat: 'P50 Latency by AZ',
//         intervalMs: 60000,
//         maxDataPoints: 500
//       },
//       relativeTimeRange: { from: 600, to: 0 }
//     },
//     {
//       refId: 'B',
//       queryType: 'expression',
//       datasourceUid: '__expr__',
//       model: {
//         refId: 'B',
//         type: 'reduce',
//         expression: 'A',
//         reducer: 'max',
//         settings: { mode: 'strict' }
//       }
//     },
//     {
//       refId: 'C',
//       queryType: 'expression',
//       datasourceUid: '__expr__',
//       model: {
//         refId: 'C',
//         type: 'threshold',
//         expression: 'B',
//         conditions: [
//           {
//             evaluator: {
//               params: [0.5],
//               type: 'gt'
//             }
//           }
//         ]
//       }
//     }
//   ],
//   condition: 'C',
//   folder: { uid: 'benldbkcq3gg0f', title: '"WeirdPermissionFolder' },
//   annotations: [
//     { key: 'summary', value: 'Image Provider P50 latency is high' },
//     { key: 'description', value: 'The 50th percentile latency for imageprovider service has exceeded 500ms' }
//   ],
//   labels: [
//     { key: 'severity', value: 'warning' },
//     { key: 'service', value: 'imageprovider' },
//     { key: 'metric_type', value: 'latency' }
//   ]
// };
