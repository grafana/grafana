import { PluginSignatureType } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getPluginSettings } from '../pluginSettings';

type SandboxEligibilityCheckParams = {
  isAngular?: boolean;
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

export async function shouldLoadPluginInFrontendSandbox({
  isAngular,
  pluginId,
}: SandboxEligibilityCheckParams): Promise<boolean> {
  // basic check if the plugin is eligible for the sandbox
  if (!(await isPluginFrontendSandboxEligible({ isAngular, pluginId }))) {
    return false;
  }

  return sandboxEnabledCheck({ isAngular, pluginId });
}

/**
 * This is a basic check that checks if the plugin is eligible to run in the sandbox.
 * It does not check if the plugin is actually enabled for the sandbox.
 */
export async function isPluginFrontendSandboxEligible({
  isAngular,
  pluginId,
}: SandboxEligibilityCheckParams): Promise<boolean> {
  // Only if the feature is not enabled no support for sandbox
  if (!Boolean(config.featureToggles.pluginsFrontendSandbox)) {
    return false;
  }

  // no support for angular plugins
  if (isAngular) {
    return false;
  }

  // To fast-test and debug the sandbox in the browser (dev mode only).
  const sandboxDisableQueryParam = location.search.includes('nosandbox') && config.buildInfo.env === 'development';
  if (sandboxDisableQueryParam) {
    return false;
  }

  // no sandbox in test mode. it often breaks e2e tests
  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  try {
    // don't run grafana-signed plugins in sandbox
    const pluginMeta = await getPluginSettings(pluginId, { showErrorAlert: false });
    if (pluginMeta.signatureType === PluginSignatureType.grafana || pluginMeta.signature === 'internal') {
      return false;
    }
  } catch (e) {
    // this can fail if we are trying to fetch settings of a non-installed plugin
    return false;
  }

  return true;
}

/**
 * Check if the plugin is enabled for the sandbox via configuration.
 */
export async function isPluginFrontendSandboxEnabled({ pluginId }: SandboxEligibilityCheckParams): Promise<boolean> {
  return Boolean(config.enableFrontendSandboxForPlugins?.includes(pluginId));
}
