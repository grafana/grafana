import memoize from 'micro-memoize';

import { formattedValueToString, getValueFormat, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { contextSrv } from 'app/core/services/context_srv';
import { constructDataSourceExploreUrl } from 'app/features/datasources/utils';

import { SYNTHETIC_MONITORING_APP_ID, SYNTHETIC_MONITORING_CHECKS_WRITE } from './appPluginIds';
import { accessibleAppPage, openAppLabel, openExploreLabel } from './pluginPages';
import { datasourceFact } from './probeUtils';
import { solutionOffer } from './solutionOffer';
import { detectSignal } from './solutionState';
import {
  fetchSyntheticsHealth,
  fetchSyntheticsStats,
  fetchSyntheticsSuccessSeries,
  probeSyntheticChecks,
} from './syntheticsData';
import { type Solution } from './types';

const formatUsageNumber = getValueFormat('short');

export function syntheticsSolution(): Solution {
  const detect = memoize(() => detectSignal(probeSyntheticChecks));
  const datasource = async () => (await detect()).datasource;

  const stats = datasourceFact(datasource, fetchSyntheticsStats);
  const health = datasourceFact(datasource, fetchSyntheticsHealth);
  const successSeries = datasourceFact(datasource, fetchSyntheticsSuccessSeries);

  const alert = memoize(async () => {
    const status = await health();
    if (!status || status.failing === null || status.failing <= 0) {
      return null;
    }

    const details: string[] = [];
    if (status.worstCheck && status.worstRatio != null) {
      details.push(
        t('home.solutions.synthetics.failing-worst', '{{check}} at {{percent}}%', {
          check: status.worstCheck,
          percent: Math.round(status.worstRatio * 100),
        })
      );
    }
    return {
      primary: t('home.solutions.synthetics.failing', '', {
        count: Math.ceil(status.failing),
        defaultValue_one: '{{count}} check failing',
        defaultValue_other: '{{count}} checks failing',
      }),
      details,
    };
  });

  const signal = async () => (await detect()).status;
  const needsAttention = async () => ((await health())?.failing ?? 0) > 0;

  return {
    id: 'synthetics',
    icon: 'globe',
    title: t('home.solutions.synthetics.title', 'Synthetic Monitoring'),
    signal,
    datasource,
    needsAttention,
    offer: solutionOffer(signal, {
      appId: SYNTHETIC_MONITORING_APP_ID,
      description: t(
        'home.solutions.synthetics.description',
        'Monitor uptime and performance of your endpoints from probes around the world.'
      ),
      setupHint: t('home.solutions.synthetics.setup-hint', 'create a check'),
      setupCta: async () => {
        // Hide setup when this user cannot open the destination or create a check there.
        if (!contextSrv.hasPermission(SYNTHETIC_MONITORING_CHECKS_WRITE)) {
          return null;
        }
        const page = await accessibleAppPage(SYNTHETIC_MONITORING_APP_ID, '/checks/choose-type');
        return page
          ? {
              label: t('home.solutions.synthetics.create-check', 'Create a check'),
              href: locationUtil.assureBaseUrl(page),
              action: 'setup',
            }
          : null;
      },
      getLearnMore: () => ({ href: 'https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/' }),
    }),
    refinedStats: async () => null,
    alert,
    stats: async () => {
      const usage = await stats();
      if (!usage?.checks || usage.checks <= 0) {
        return null;
      }
      const checkCount = Math.ceil(usage.checks);
      return {
        primary: t('home.solutions.synthetics.checks', '', {
          count: checkCount,
          value: formattedValueToString(formatUsageNumber(checkCount)),
          defaultValue_one: '{{value}} check',
          defaultValue_other: '{{value}} checks',
        }),
        secondary:
          usage.successRatio != null
            ? t('home.solutions.synthetics.stats', '{{percent}}% success · 24h', {
                percent: parseFloat((usage.successRatio * 100).toFixed(1)),
              })
            : undefined,
      };
    },
    sparkline: async () => {
      const series = await successSeries();
      return series
        ? { series, caption: t('home.solutions.synthetics.success-trend', 'Success rate · last 24h') }
        : null;
    },
    cta: async () => {
      const ds = await datasource();
      if (!ds) {
        return null;
      }
      if (await needsAttention().catch(() => false)) {
        const checksPage = await accessibleAppPage(SYNTHETIC_MONITORING_APP_ID, '/checks');
        if (checksPage) {
          return {
            label: t('home.solutions.synthetics.view-checks', 'View failing checks'),
            href: locationUtil.assureBaseUrl(checksPage),
            action: 'view_alerts',
          };
        }
      }
      const homePage = await accessibleAppPage(SYNTHETIC_MONITORING_APP_ID, '/home');
      return homePage
        ? {
            label: openAppLabel('Synthetic Monitoring'),
            href: locationUtil.assureBaseUrl(homePage),
            action: 'open_solution',
          }
        : {
            label: openExploreLabel(),
            href: constructDataSourceExploreUrl({ name: ds.name }),
            action: 'open_solution',
          };
    },
  };
}
