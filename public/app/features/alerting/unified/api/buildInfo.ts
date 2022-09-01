import { lastValueFrom } from 'rxjs';

import { getBackendSrv, isFetchError } from '@grafana/runtime';
import {
  AlertmanagerApiFeatures,
  PromApiFeatures,
  PromApplication,
  PromBuildInfoResponse,
  PromBuildInfoSeriesResponse,
  RulesQueryErrorResponse,
  ThanosFlagsResponse,
} from 'app/types/unified-alerting-dto';

import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';
import { getDataSourceByName, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { fetchRules } from './prometheus';
import { fetchTestRulerRulesGroup } from './ruler';

/**
 * Attempt to fetch buildinfo from our component
 */
export async function discoverFeatures(dataSourceName: string): Promise<PromApiFeatures> {
  if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return {
      features: {
        rulerApiEnabled: true,
      },
    };
  }

  const dsConfig = getDataSourceByName(dataSourceName);
  if (!dsConfig) {
    throw new Error(`Cannot find data source configuration for ${dataSourceName}`);
  }

  const { url, name, type } = dsConfig;
  if (!url) {
    throw new Error(`The data source url cannot be empty.`);
  }

  if (type !== 'prometheus' && type !== 'loki') {
    throw new Error(`The build info request is not available for ${type}. Only 'prometheus' and 'loki' are supported`);
  }

  return discoverDataSourceFeatures({ name, url, type });
}

/**
 * This function will attempt to detect what type of system we are talking to; this could be
 * Prometheus (vanilla) | Cortex | Mimir
 *
 * Cortex and Mimir allow editing rules via their API, Prometheus does not.
 * Prometheus and Mimir expose a `buildinfo` endpoint, Cortex does not.
 * Mimir reports which "features" are enabled or available via the buildinfo endpoint, Prometheus does not.
 */
export async function discoverDataSourceFeatures(dsSettings: {
  url: string;
  name: string;
  type: 'prometheus' | 'loki';
}): Promise<PromApiFeatures> {
  const { url, name, type } = dsSettings;

  // The current implementation of Loki's build info endpoint is useless
  // because it doesn't provide information about Loki's available features (e.g. Ruler API)
  // It's better to skip fetching it for Loki and go the Cortex path (manual discovery)

  let fallBackInfoResponse: PromBuildInfoSeriesResponse | undefined;
  const isLoki = type === 'loki';
  const buildInfoResponse = isLoki
    ? undefined
    : await fetchPromBuildInfo(url).catch(async () => {
        fallBackInfoResponse = await fetchPromBuildInfoFallback(url);
      });

  const prometheusBuildInfoSeriesMetric = fallBackInfoResponse?.data?.result?.length
    ? fallBackInfoResponse?.data?.result[0]?.metric ?? undefined
    : undefined;
  // check if the component returns buildinfo
  const hasBuildInfo = buildInfoResponse !== undefined;

  // Assuming we couldn't get build info, and the fetchPromBuildInfo didn't throw an Error causing the fallback to get triggered,
  // we are dealing with a Cortex or Loki datasource since the response for buildinfo came up empty
  if (!hasBuildInfo && !prometheusBuildInfoSeriesMetric) {
    // check if we can fetch rules via the prometheus compatible api
    const promRulesSupported = await hasPromRulesSupport(name);
    if (!promRulesSupported) {
      throw new Error(`Unable to fetch alert rules. Is the ${name} data source properly configured?`);
    }

    // check if the ruler is enabled
    const rulerSupported = await hasRulerSupport(name);

    // Thanos versions before 0.15 do not support the buildinfo api endpoint, and will currently get marked as Cortex
    return {
      application: PromApplication.Lotex,
      features: {
        rulerApiEnabled: rulerSupported,
      },
    };
  }

  // Otherwise if we don't have build info, but we did trigger the fallback, we should be dealing with a prometheus datasource that's older than 2.14.0
  else if (!hasBuildInfo) {
    return {
      version: prometheusBuildInfoSeriesMetric?.version,
      application: PromApplication.Prometheus,
      features: {
        rulerApiEnabled: false,
      },
    };
  }

  // If it's not cortex or old prometheus, it might be Thanos let's check their flags API
  const thanosFlags = await fetchThanosFlags(url);
  if (thanosFlags) {
    const rulerSupported = await hasRulerSupport(name);
    return {
      application: PromApplication.Thanos,
      version: buildInfoResponse.data.version,
      features: {
        rulerApiEnabled: rulerSupported,
      },
    };
  }

  // if no features are reported but buildinfo was returned we're talking to modern Prometheus
  const { features } = buildInfoResponse.data;
  if (!features) {
    return {
      version: buildInfoResponse.data.version,
      application: PromApplication.Prometheus,
      features: {
        rulerApiEnabled: false,
      },
    };
  }

  // Mimir does return a version, but this is the mimir version, and not the prometheus version.
  // We do not want to use mimir version numbers to detect feature support, we should instead ask the mimir team to add new flags.
  if (buildInfoResponse.data.application === 'Grafana Mimir') {
    return {
      version: buildInfoResponse.data.version,
      application: PromApplication.Mimir,
      features: {
        rulerApiEnabled: features?.ruler_config_api === 'true',
      },
    };
  }

  // If everything else failed? We don't know what the flavor is, this shouldn't happen, but anything is possible.
  console.warn(
    'Unknown prometheus flavor! Returning default prometheus configuration: some features may not be available'
  );
  return {
    application: PromApplication.Prometheus,
    features: {
      rulerApiEnabled: false,
    },
  };
}

export async function discoverAlertmanagerFeatures(amSourceName: string): Promise<AlertmanagerApiFeatures> {
  if (amSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return { lazyConfigInit: false };
  }

  const dsConfig = getDataSourceConfig(amSourceName);

  const { url, type } = dsConfig;
  if (!url) {
    throw new Error(`The data source url cannot be empty.`);
  }

  if (type !== 'alertmanager') {
    throw new Error(
      `Alertmanager feature discovery is not available for ${type}. Only 'alertmanager' type is supported`
    );
  }

  return await discoverAlertmanagerFeaturesByUrl(url);
}

export async function discoverAlertmanagerFeaturesByUrl(url: string): Promise<AlertmanagerApiFeatures> {
  try {
    const buildInfo = await fetchPromBuildInfo(url);
    return { lazyConfigInit: buildInfo?.data?.application === 'Grafana Mimir' };
  } catch (e) {
    // If we cannot access the build info then we assume the lazy config is not available
    return { lazyConfigInit: false };
  }
}

function getDataSourceConfig(amSourceName: string) {
  const dsConfig = getDataSourceByName(amSourceName);
  if (!dsConfig) {
    throw new Error(`Cannot find data source configuration for ${amSourceName}`);
  }
  return dsConfig;
}

export async function fetchPromBuildInfo(url: string): Promise<PromBuildInfoResponse | undefined> {
  // This API endpoint only works on versions of prometheus 2.14.0 and up
  const response = await lastValueFrom(
    getBackendSrv().fetch<PromBuildInfoResponse>({
      url: `${url}/api/v1/status/buildinfo`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  ).catch((e) => {
    if ('status' in e && e.status === 404) {
      return undefined; // Cortex does not support buildinfo endpoint, we return an empty response
    }

    throw e;
  });

  return response?.data;
}

async function fetchThanosFlags(url: string): Promise<ThanosFlagsResponse | undefined> {
  // This API endpoint only works on versions of prometheus 2.14.0 and up
  const response = await lastValueFrom(
    getBackendSrv().fetch<ThanosFlagsResponse>({
      url: `${url}/api/v1/status/flags`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  ).catch((e) => {
    return undefined;
  });

  return response?.data;
}

export async function fetchPromBuildInfoFallback(url: string): Promise<PromBuildInfoSeriesResponse | undefined> {
  const response = await lastValueFrom(
    getBackendSrv().fetch<PromBuildInfoSeriesResponse>({
      url: `${url}/api/v1/query?query=prometheus_build_info`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  ).catch(() => {
    // We have failed to get the build information
    console.warn('Failed to get prometheus fallback build information.');
    return undefined;
  });

  return response?.data;
}

/**
 * Check if the component allows us to fetch rules
 */
async function hasPromRulesSupport(dataSourceName: string) {
  try {
    await fetchRules(dataSourceName);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Attempt to check if the ruler API is enabled for Cortex, Prometheus does not support it and Mimir
 * reports this via the buildInfo "features"
 */
async function hasRulerSupport(dataSourceName: string) {
  try {
    await fetchTestRulerRulesGroup(dataSourceName);
    return true;
  } catch (e) {
    if (errorIndicatesMissingRulerSupport(e as RulesQueryErrorResponse)) {
      return false;
    }
    throw e;
  }
}

// there errors indicate that the ruler API might be disabled or not supported for Cortex
function errorIndicatesMissingRulerSupport(error: RulesQueryErrorResponse) {
  return (
    (isFetchError(error) &&
      (error.data.message?.includes('GetRuleGroup unsupported in rule local store') || // "local" rule storage
        error.data.message?.includes('page not found'))) || // ruler api disabled
    error.message?.includes('404 from rules config endpoint') || // ruler api disabled
    error.data.message?.includes(RULER_NOT_SUPPORTED_MSG) // ruler api not supported
  );
}
