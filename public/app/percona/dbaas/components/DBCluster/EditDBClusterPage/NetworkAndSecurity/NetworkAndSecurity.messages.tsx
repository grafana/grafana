export const Messages = {
  labels: {
    internetFacing: 'Internet Facing (EKS only)',
    sourceRange: 'Source Range',
  },
  fieldSets: {
    expose: 'Enable external access',
  },
  buttons: {
    addNew: 'Add new',
  },
  tooltips: {
    expose:
      'You will make this database cluster available to connect from the internet. To limit access you need to specify source ranges',
    internetFacing:
      'This is an AWS specific configuration required if you want to access your database cluster outside of your VPC',
  },
  placeholders: {
    sourceRange: '181.170.213.40/32',
  },
};
