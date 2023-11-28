import React, { FC, useCallback, useEffect, useState } from 'react';
import { Row } from 'react-table';

import { Collapse, HorizontalGroup, Icon, IconName } from '@grafana/ui';
import { DATABASE_ICONS } from 'app/percona/shared/core';

import { FlattenService } from '../../Inventory.types';

import { ClusterItemProps } from './Clusters.type';
import { removeClusterFilters, shouldClusterBeExpanded } from './Clusters.utils';
import ServicesTable from './ServicesTable';

const ClusterItem: FC<React.PropsWithChildren<ClusterItemProps>> = ({ cluster, onDelete, onSelectionChange }) => {
  const [isOpen, setIsOpen] = useState(shouldClusterBeExpanded(cluster.name));
  const icon: IconName = cluster.type ? (DATABASE_ICONS[cluster.type] as IconName) : 'database';

  const handleSelectionChange = useCallback(
    (services: Array<Row<FlattenService>>) => {
      onSelectionChange(cluster, services);
    },
    [cluster, onSelectionChange]
  );

  useEffect(() => {
    if (!isOpen) {
      removeClusterFilters(cluster.name);
    }
  }, [isOpen, cluster.name]);

  return (
    <Collapse
      collapsible
      label={
        <HorizontalGroup>
          {!!icon && <Icon name={icon} data-testid="service-icon" />}
          <span>{cluster.name}</span>
        </HorizontalGroup>
      }
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <ServicesTable
        flattenServices={cluster.services}
        isLoading={false}
        onDelete={onDelete}
        onSelectionChange={handleSelectionChange}
        tableKey={cluster.name}
        showPagination={false}
      />
    </Collapse>
  );
};

export default ClusterItem;
