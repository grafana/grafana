import { locationService } from '@grafana/runtime';
import { Databases } from 'app/percona/shared/core';

import { FlattenService } from '../../Inventory.types';

import { ServicesCluster } from './Clusters.type';

export const getClustersFromServices = (services: FlattenService[]): ServicesCluster[] => {
  const clusterNames = [...new Set(services.map((s) => s.cluster || s.serviceName))];
  return clusterNames.map<ServicesCluster>((clusterName) => {
    const clusterServices = services.filter((s) => s.cluster === clusterName);

    return {
      name: clusterName,
      type: clusterServices[0]?.type as Databases,
      services: clusterServices,
    };
  });
};

export const shouldClusterBeExpanded = (clusterName: string): boolean => {
  const search = locationService.getSearchObject();
  return !!search[clusterName];
};

export const removeClusterFilters = (clusterName: string) => {
  const search = locationService.getSearchObject();
  locationService.partial({ ...search, [clusterName]: undefined });
};
