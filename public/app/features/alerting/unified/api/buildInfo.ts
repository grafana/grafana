import { getBackendSrv } from '@grafana/runtime';
import { PromApplication, PromBuildInfo, PromBuildInfoResponse } from 'app/types/unified-alerting-dto';
import { lastValueFrom } from 'rxjs';
import { isFetchError } from '../utils/alertmanager';
import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';
import { getDataSourceByName } from '../utils/datasource';
import { fetchRules } from './prometheus';
import { fetchTestRulerRulesGroup } from './ruler';

/**
 * This function will attempt to detect what type of system we are talking to; this could be
 * Prometheus (vanilla) | Cortex | Mimir
 *
 * Cortex and Mimir allow editing rules via their API, Prometheus does not.
 * Prometheus and Mimir expose a `buildinfo` endpoint, Cortex does not.
 * Mimir reports which "features" are enabled or available via the buildinfo endpoint, Prometheus does not.
 */
export async function fetchDataSourceBuildInfo(dsSettings: { url: string; name: string }): Promise<PromBuildInfo> {
  const { url, name } = dsSettings;

  const response = await lastValueFrom(
    getBackendSrv().fetch<PromBuildInfoResponse>({
      url: `${url}/api/v1/status/buildinfo`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  ).catch((e) => {
    if ('status' in e && e.status === 404) {
      return null; // Cortex does not support buildinfo endpoint, we return an empty response
    }

    throw e;
  });

  // check if the component returns buildinfo
  const hasBuildInfo = response !== null;

  // we are dealing with a Cortex datasource since the response for buildinfo came up empty
  if (!hasBuildInfo) {
    // check if we can fetch rules via the prometheus compatible api
    const promRulesSupported = await hasPromRulesSupport(name);
    if (!promRulesSupported) {
      throw new Error(`Unable to fetch alert rules. Is the ${name} data source properly configured?`);
    }

    // check if the ruler is enabled
    const rulerSupported = await hasRulerSupport(name);

    return {
      application: PromApplication.Cortex,
      features: {
        rulerApiEnabled: rulerSupported,
      },
    };
  }

  // if no features are reported but buildinfo was return we're talking to Prometheus
  const { features } = response.data.data;
  if (!features) {
    return {
      application: PromApplication.Prometheus,
      features: {
        rulerApiEnabled: false,
      },
    };
  }

  // if we have both features and buildinfo reported we're talking to Mimir
  return {
    application: PromApplication.Mimir,
    features: {
      rulerApiEnabled: features?.ruler_config_api === 'true',
    },
  };
}

/**
 * Attempt to fetch buildinfo from our component
 */
export async function fetchBuildInfo(dataSourceName: string): Promise<PromBuildInfo> {
  const dsConfig = getDataSourceByName(dataSourceName);
  if (!dsConfig) {
    throw new Error(`Cannot find data source configuration for ${dataSourceName}`);
  }
  const { url, name } = dsConfig;
  if (!url) {
    throw new Error(`The data souce url cannot be empty.`);
  }

  return fetchDataSourceBuildInfo({ name, url });
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
    if (errorIndicatesMissingRulerSupport(e)) {
      return false;
    }
    throw e;
  }
}

// there errors indicate that the ruler API might be disabled or not supported for Cortex
function errorIndicatesMissingRulerSupport(error: any) {
  return (
    (isFetchError(error) &&
      (error.data.message?.includes('GetRuleGroup unsupported in rule local store') || // "local" rule storage
        error.data.message?.includes('page not found'))) || // ruler api disabled
    error.message?.includes('404 from rules config endpoint') || // ruler api disabled
    error.data.message?.includes(RULER_NOT_SUPPORTED_MSG) // ruler api not supported
  );
}
