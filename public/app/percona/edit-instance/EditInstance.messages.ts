export const Messages = {
  title: 'Inventory / Edit Service',
  cancel: 'Cancel',
  saveChanges: 'Save Changes',
  formTitle: (service: string) => `Editing “${service}” service`,
  success: {
    title: (service: string) => `Service “${service}” was changed`,
    description: 'It is now ready to continue monitoring.',
  },
  modal: {
    description:
      'Changing existing labels can affect other parts of PMM dependent on it, such as: alerting, data in dashboards, etc. ',
    details: 'Find more details about it in ',
    detailsLink: 'our documentation',
    dot: '.',
    confirm: 'Confirm and save changes',
    cancel: 'Cancel',
    cluster: {
      title: 'Cluster label changed',
      description:
        'Changing the cluster label will remove all scheduled backups for the impacted service/cluster. Make sure to recreate your backups after finishing the cluster configuration. For  more information, see ',
      descriptionLink: 'Editing Labels',
      dot: '.',
    },
  },
};
