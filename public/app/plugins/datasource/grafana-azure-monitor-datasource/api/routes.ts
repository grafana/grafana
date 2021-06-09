export function getManagementApiRoute(azureCloud: string): string {
  switch (azureCloud) {
    case 'azuremonitor':
      return 'azuremonitor';
    case 'chinaazuremonitor':
      return 'chinaazuremonitor';
    case 'govazuremonitor':
      return 'govazuremonitor';
    case 'germanyazuremonitor':
      return 'germanyazuremonitor';
    default:
      throw new Error('The cloud not supported.');
  }
}

export function getLogAnalyticsManagementApiRoute(azureCloud: string): string {
  switch (azureCloud) {
    case 'azuremonitor':
      return 'workspacesloganalytics';
    case 'chinaazuremonitor':
      return 'chinaworkspacesloganalytics';
    case 'govazuremonitor':
      return 'govworkspacesloganalytics';
    case 'germanyazuremonitor':
      return 'germanyworkspacesloganalytics';
    default:
      throw new Error('The cloud not supported.');
  }
}

export function getLogAnalyticsApiRoute(azureCloud: string): string {
  switch (azureCloud) {
    case 'azuremonitor':
      return 'loganalyticsazure';
    case 'chinaazuremonitor':
      return 'chinaloganalyticsazure';
    case 'govazuremonitor':
      return 'govloganalyticsazure';
    default:
      throw new Error('The cloud not supported.');
  }
}

export function getAppInsightsApiRoute(azureCloud: string): string {
  switch (azureCloud) {
    case 'azuremonitor':
      return 'appinsights';
    case 'chinaazuremonitor':
      return 'chinaappinsights';
    default:
      throw new Error('The cloud not supported.');
  }
}
