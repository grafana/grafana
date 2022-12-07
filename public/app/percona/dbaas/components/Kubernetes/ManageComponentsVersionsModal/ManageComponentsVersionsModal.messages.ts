import { Operators } from '../../DBCluster/EditDBClusterPage/DBClusterBasicOptions/DBClusterBasicOptions.types';

export const Messages = {
  cancel: 'Cancel',
  fields: {
    component: 'Component',
    versions: 'Versions',
    operator: 'Operator',
    default: 'Default',
  },
  title: 'Manage Components Versions',
  required: 'Required field',
  recommended: 'Recommended',
  save: 'Save',
  success: 'Components versions updated successfully',
  operatorLabel: {
    [Operators.pxc]: (version: string) => `Percona Operator for MySQL ${version}`,
    [Operators.psmdb]: (version: string) => `Percona Operator for MongoDB ${version}`,
  },
  componentLabel: {
    pxc: 'Percona Operator for MySQL',
    haproxy: 'HAProxy',
    backup: 'Backup',
    mongod: 'Percona Operator for MongoDB',
  },
};
