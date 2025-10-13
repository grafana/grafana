export const Messages = {
  title: 'Confirmation required',
  warning: 'Attention! This action is irreversible!',
  forceMode: {
    label: 'Force mode',
    description: 'Force mode is going to delete all associated agents.',
  },
  submit: (nrItems: number) => `Yes, delete service${nrItems > 1 ? 's' : ''}`,
  cancel: 'Cancel',
  deleteConfirmation: (nrItems: number) =>
    `Are you sure that you want to permanently delete ${nrItems} service${nrItems > 1 ? 's' : ''}`,
  servicesDeleted: (deletedItems: number, totalItems: number) =>
    `${deletedItems} of ${totalItems} services successfully deleted`,
};
