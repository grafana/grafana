import React, { FC, useCallback, useMemo, useState } from 'react';
import { Row } from 'react-table';

import { SearchFilter } from 'app/percona/shared/components/SearchFilter';

import { Messages } from '../../Inventory.messages';
import { FlattenService } from '../../Inventory.types';

import ClusterItem from './ClusterItem';
import { CLUSTERS_COLUMNS } from './Clusters.constants';
import { ClustersProps, ServicesCluster } from './Clusters.type';
import { getClustersFromServices } from './Clusters.utils';

const Clusters: FC<ClustersProps> = ({ services, onDelete, onSelectionChange }) => {
  const [filtered, setFiltered] = useState(services);
  const clusters = useMemo(() => getClustersFromServices(filtered), [filtered]);
  const [selection, setSelection] = useState({});
  const filterEnabled = filtered !== services;

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

  const handleFiltering = useCallback((rows: FlattenService[]) => {
    setFiltered(rows);
  }, []);

  return (
    <div>
      <SearchFilter
        tableKey="clusters-global"
        rawData={services}
        columns={CLUSTERS_COLUMNS}
        onFilteredDataChange={handleFiltering}
      />
      {clusters.length ? (
        clusters.map((cluster) => (
          <ClusterItem
            key={cluster.name}
            cluster={cluster}
            onDelete={onDelete}
            openByDefault={filterEnabled}
            onSelectionChange={handleSelectionChange}
          />
        ))
      ) : filterEnabled ? (
        <div>{Messages.clusters.noMatch}</div>
      ) : (
        <div>{Messages.clusters.empty}</div>
      )}
    </div>
  );
};

export default Clusters;
