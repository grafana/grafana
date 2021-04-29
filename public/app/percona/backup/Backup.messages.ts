export const Messages = {
  tabs: {
    inventory: 'Backup Inventory',
    scheduled: 'Scheduled Backups',
    locations: 'Storage Locations',
    restore: 'Restore History',
  },
  add: 'Add',
  backupManagement: 'Backup Management',
  backupInventory: {
    table: {
      noData: 'No backups found',
      columns: {
        name: 'Backup name',
        created: 'Created',
        location: 'Location',
        vendor: 'Vendor',
        status: 'Status',
        actions: 'Actions',
      },
      status: {
        invalid: 'Invalid',
        pending: 'Pending',
        inProgress: 'In progress',
        paused: 'Paused',
        success: 'Success',
        error: 'Error',
      },
      dataModel: {
        invalid: 'Invalid',
        physical: 'Physical',
        logical: 'Logical',
      },
      actions: 'Actions',
    },
  },
  restoreHistory: {
    table: {
      noData: 'No restores found',
      columns: {
        started: 'Started at',
      },
    },
  },
  storageLocations: {
    table: {
      noData: 'No storage locations found',
      columns: {
        name: 'Name',
        type: 'Type',
        path: 'Endpoint or path',
        labels: 'Labels',
        actions: 'Actions',
      },
    },
    addSuccess: 'Backup location was successfully added',
    testSuccess: 'This storage location is valid',
    editSuccess: (name: string) => `Backup location "${name}" was successfully updated`,
    getDeleteSuccess: (name: string) => `Backup location "${name}" successfully deleted.`,
  },
  status: {
    invalid: 'Invalid',
    pending: 'Pending',
    inProgress: 'In progress',
    paused: 'Paused',
    success: 'Success',
    error: 'Error',
  },
  dataModel: {
    invalid: 'Invalid',
    physical: 'Physical',
    logical: 'Logical',
  },
};
