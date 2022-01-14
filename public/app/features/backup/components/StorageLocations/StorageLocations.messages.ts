export const Messages = {
  noData: 'No storage locations found',
  columns: {
    name: 'Name',
    type: 'Type',
    path: 'Endpoint or path',
    labels: 'Labels',
    actions: 'Actions',
  },
  add: 'Add',
  addSuccess: 'Backup location was successfully added',
  getDeleteSuccess: (name: string) => `Backup location "${name}" successfully deleted.`,
};
