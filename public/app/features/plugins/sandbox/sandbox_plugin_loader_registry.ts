import { PluginSignatureType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';

import { getPluginDetails } from '../admin/api';
import { getPluginSettings } from '../pluginSettings';

type SandboxEligibilityCheckParams = {
  pluginId: string;
};

type SandboxEnabledCheck = (params: SandboxEligibilityCheckParams) => Promise<boolean>;

/**
 * We allow core extensions to register their own
 * sandbox enabled checks.
 */
let sandboxEnabledCheck: SandboxEnabledCheck = isPluginFrontendSandboxEnabled;

export function setSandboxEnabledCheck(checker: SandboxEnabledCheck) {
  sandboxEnabledCheck = checker;
}

export async function shouldLoadPluginInFrontendSandbox({ pluginId }: SandboxEligibilityCheckParams): Promise<boolean> {
  // basic check if the plugin is eligible for the sandbox
  if (!(await isPluginFrontendSandboxEligible({ pluginId }))) {
    return false;
  }

  return sandboxEnabledCheck({ pluginId });
}

/**
 * This is a basic check that checks if the plugin is eligible to run in the sandbox.
 * It does not check if the plugin is actually enabled for the sandbox.
 */
export async function isPluginFrontendSandboxEligible({ pluginId }: SandboxEligibilityCheckParams): Promise<boolean> {
  // Only if the feature is not enabled no support for sandbox
  if (!Boolean(config.featureToggles.pluginsFrontendSandbox)) {
    return false;
  }

  // To fast-test and debug the sandbox in the browser (dev mode only).
  const sandboxDisableQueryParam =
    window.location.search.includes('nosandbox') && config.buildInfo.env === 'development';
  if (sandboxDisableQueryParam) {
    return false;
  }

  // no sandbox in test mode. it often breaks e2e tests
  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  if (!contextSrv.isSignedIn) {
    return false;
  }

  // grafana signature and internal plugins are not allowed in the sandbox
  return isPluginSignatureEligibleForSandbox({ pluginId });
}

async function isPluginSignatureEligibleForSandbox({ pluginId }: SandboxEligibilityCheckParams): Promise<boolean> {
  try {
    // this can fail if we are trying to fetch settings of a non-installed plugin
    const pluginMeta = await getPluginSettings(pluginId, { showErrorAlert: false });
    return pluginMeta.signatureType !== PluginSignatureType.grafana && pluginMeta.signature !== 'internal';
  } catch (e) {
    try {
      //this can fail if gcom is not accesible
      const details = await getPluginDetails(pluginId);
      return details.signatureType !== PluginSignatureType.grafana && details.signature !== 'internal';
    } catch (e) {
      return false;
    }
  }
}

/**
 * Check if the plugin is enabled for the sandbox via configuration.
 */
export async function isPluginFrontendSandboxEnabled({ pluginId }: SandboxEligibilityCheckParams): Promise<boolean> {
  return Boolean(config.enableFrontendSandboxForPlugins?.includes(pluginId));
}
