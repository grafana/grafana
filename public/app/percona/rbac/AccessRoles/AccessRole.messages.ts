export const Messages = {
  title: 'Access Roles',
  subtitle: {
    text: 'Access roles is a way to control the access to metrics and some PMM functionalities, for an increased security standard. Worth noting that every time you invite new users, the default role will be assigned to them.',
    further: ' For futher explanation on ',
    link: 'how the Access roles work, check our documentation',
    dot: '.',
  },
  name: {
    column: 'Name',
  },
  description: {
    column: 'Description',
  },
  metrics: {
    column: 'Metrics access ',
    tooltip: 'Roles are built using service labels.',
    // todo: add back in when option to edit service labels is available
    // tooltip: 'Roles are built using service labels. Go to Inventory > Services to edit labels.',
  },
  options: {
    column: 'Options',
    edit: 'Edit',
    default: 'Set as default',
    delete: 'Delete',
    iconLabel: 'Open role options',
  },
  default: {
    text: 'Default',
    tooltip: 'The role that will be applied to new users.',
  },
  delete: {
    title: (role: string) => `Delete "${role}" role`,
    description:
      'Are you sure you want to delete this role? You won’t be able to recover it. Please confirm your action below.',
    assigned: (role: string) =>
      `There are users associated to this role. Please assign a different role to users with the ”${role}” role.`,
    submit: 'Confirm and delete role',
    cancel: 'Cancel',
    success: {
      title: (role: string) => `Role “${role}“ deleted`,
      body: 'The role no longer exists',
    },
  },
  create: 'Create',
  noRoles: 'No roles available',
};
