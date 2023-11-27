import { Row } from 'react-table';

import { Databases } from 'app/percona/shared/core';

import { FlattenService } from '../../Inventory.types';

export interface ClustersProps {
  services: FlattenService[];
  onDelete: (service: FlattenService) => void;
  onSelectionChange: (services: Array<Row<FlattenService>>) => void;
}

export interface ClusterItemProps {
  cluster: ServicesCluster;
  openByDefault?: boolean;
  onDelete: (service: FlattenService) => void;
  onSelectionChange: (cluster: ServicesCluster, services: Array<Row<FlattenService>>) => void;
}

export interface ServicesCluster {
  name: string;
  type?: Databases;
  services: FlattenService[];
}
