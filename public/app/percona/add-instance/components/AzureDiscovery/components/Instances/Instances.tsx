import React, { FC } from 'react';

import { Table } from 'app/percona/shared/components/Elements/AnotherTableInstance/Table';

import { styles } from './Instances.styles';
import { InstancesTableProps } from './Instances.types';
import { getInstancesColumns } from './InstancesColumns';

const Instances: FC<InstancesTableProps> = (props) => {
  const { instances, selectInstance, credentials, loading } = props;

  const columns = getInstancesColumns(credentials, selectInstance);

  return (
    <div className={styles.tableWrapper}>
      <Table columns={columns} data={instances} loading={loading} />
    </div>
  );
};

export default Instances;
