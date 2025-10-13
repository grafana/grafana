import { Databases } from '../core';

export const getDashboardLinkForService = (serviceType: Databases | 'external', serviceName: string) =>
  `/d/${serviceType}-instance-summary/${serviceType}-instance-summary?var-service_name=${serviceName}`;
