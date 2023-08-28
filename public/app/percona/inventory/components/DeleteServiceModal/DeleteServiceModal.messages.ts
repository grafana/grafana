export const Messages = {
  title: 'Confirmation required',
  warning: 'Attention! This action is irreversible!',
  forceMode: {
    label: 'Force mode',
    description: 'Force mode is going to delete all associated agents.',
  },
  description: (service: string) =>
    `By deleting service “${service}” you will not be able to recover it. Are you sure you want to delete it?`,
  submit: 'Yes, delete service',
  cancel: 'Cancel',
  success: (service: string) => `Service “${service}” was removed effectively`,
};
