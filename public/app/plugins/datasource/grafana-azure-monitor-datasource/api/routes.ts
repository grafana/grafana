import { AzureDataSourceSettings } from '../types';

export function getManagementApiRoute(options: AzureDataSourceSettings): string {
  switch (options.jsonData.cloudName) {
    case 'azuremonitor':
      return 'azuremonitor';
    case 'chinaazuremonitor':
      return 'chinaazuremonitor';
    case 'govazuremonitor':
      return 'govazuremonitor';
    case 'germanyazuremonitor':
      return 'germanyazuremonitor';
    default:
      throw new Error('The cloud not supported');
  }
}

export function getLogAnalyticsManagementApiRoute(options: AzureDataSourceSettings): string {
  switch (options.jsonData.cloudName) {
    case 'azuremonitor':
      return 'workspacesloganalytics';
    case 'chinaazuremonitor':
      return 'chinaworkspacesloganalytics';
    case 'govazuremonitor':
      return 'govworkspacesloganalytics';
    case 'germanyazuremonitor':
      return 'germanyworkspacesloganalytics';
    default:
      throw new Error('The cloud not supported');
  }
}
