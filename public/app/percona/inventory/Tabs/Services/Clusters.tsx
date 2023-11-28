import React, { FC, useCallback, useMemo, useState } from 'react';
import { Row } from 'react-table';

import { FlattenService } from '../../Inventory.types';

import ClusterItem from './ClusterItem';
import { ClustersProps, ServicesCluster } from './Clusters.type';
import { getClustersFromServices } from './Clusters.utils';

const Clusters: FC<React.PropsWithChildren<ClustersProps>> = ({ services, onDelete, onSelectionChange }) => {
  const clusters = useMemo(() => getClustersFromServices(services), [services]);
  const [selection, setSelection] = useState({});

  const handleSelectionChange = useCallback(
    (cluster: ServicesCluster, selectedServices: Array<Row<FlattenService>>) => {
      const selectionByClusters = {
        ...selection,
        [cluster.name]: selectedServices,
      };
      const selected = Object.values(selectionByClusters).flat() as Array<Row<FlattenService>>;
      setSelection(selectionByClusters);
      onSelectionChange(selected);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSelectionChange]
  );

  return (
    <div>
      {clusters.map((cluster) => (
        <ClusterItem
          key={cluster.name}
          cluster={cluster}
          onDelete={onDelete}
          onSelectionChange={handleSelectionChange}
        />
      ))}
    </div>
  );
};

export default Clusters;
