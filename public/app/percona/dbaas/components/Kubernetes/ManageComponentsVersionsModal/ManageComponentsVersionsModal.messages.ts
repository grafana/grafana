import { Operators } from '../../DBCluster/AddDBClusterModal/DBClusterBasicOptions/DBClusterBasicOptions.types';

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
    [Operators.pxc]: (version: string) => `PXC ${version}`,
    [Operators.psmdb]: (version: string) => `PSMDB ${version}`,
  },
  componentLabel: {
    pxc: 'PXC',
    haproxy: 'HAProxy',
    backup: 'Backup',
    mongod: 'PSMDB',
  },
};
