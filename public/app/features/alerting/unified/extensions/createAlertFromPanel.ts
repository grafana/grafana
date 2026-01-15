import { PluginExtensionAddedFunctionConfig, PluginExtensionPoints, locationUtil, urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { vizPanelToRuleFormValues } from '../utils/rule-form';

/**
 * Options for the createAlertFromPanel function.
 */
export interface CreateAlertFromPanelOptions {
  /**
   * The VizPanel to create an alert from.
   * This panel does NOT need to be part of a dashboard.
   */
  panel: VizPanel;
  /**
   * Whether to open the alert creation form in a new browser tab.
   * Defaults to true.
   */
  openInNewTab?: boolean;
}

/**
 * Result returned by the createAlertFromPanel function.
 */
export interface CreateAlertFromPanelResult {
  /** Whether the operation was successful */
  success: boolean;
  /** The URL that was navigated to (if successful) */
  url?: string;
  /** Error message if the operation failed */
  error?: string;
}

/**
 * Creates an alert rule from a standalone VizPanel and navigates to the alert creation form.
 *
 * This function is designed for VizPanels that are NOT part of a dashboard,
 * such as panels in plugin apps like Metrics Drilldown.
 *
 * By default, opens the alert creation form in a new browser tab so the user
 * can continue working in the original app.
 */
export async function createAlertFromPanel(options: CreateAlertFromPanelOptions): Promise<CreateAlertFromPanelResult> {
  const { panel, openInNewTab = true } = options;

  // Convert the VizPanel to alert rule form values
  const formValues = await vizPanelToRuleFormValues(panel);

  if (!formValues) {
    return {
      success: false,
      error: 'Unable to create alert from panel. No alerting-capable queries found.',
    };
  }

  // Build the URL with encoded defaults
  const url = urlUtil.renderUrl('/alerting/new', {
    defaults: JSON.stringify(formValues),
  });

  // Navigate to the alert creation form
  if (openInNewTab) {
    window.open(locationUtil.assureBaseUrl(url), '_blank');
  } else {
    locationService.push(url);
  }

  return {
    success: true,
    url,
  };
}

/**
 * Configuration for registering the createAlertFromPanel function as a plugin extension.
 */
export function getCreateAlertFromPanelExtensionConfig(): PluginExtensionAddedFunctionConfig<
  (options: CreateAlertFromPanelOptions) => Promise<CreateAlertFromPanelResult>
> {
  return {
    targets: [PluginExtensionPoints.AlertingCreateAlertFromPanel],
    // This is called at the top level, so will break if we add a translation here
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    title: 'Create alert from panel',
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    description: 'Creates an alert rule from a VizPanel and navigates to the alert creation form.',
    fn: createAlertFromPanel,
  };
}
