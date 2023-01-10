export const Messages = {
  fieldSets: {
    advancedSettings: 'Advanced Settings',
    pxcConfiguration: 'MySQL Configurations',
    mongodbConfiguration: 'MongoDB Configurations',
    commonConfiguration: 'Database Configurations',
    networkAndSecurity: 'Network and Security',
  },
  labels: {
    nodes: 'Number of Nodes',
    resources: 'Resources per Node',
    cpu: 'CPU',
    memory: 'Memory (GB)',
    disk: 'Disk (GB)',
    storageClass: 'Storage Class',
    pxcConfiguration: 'MySQL Configuration',
    mongodbConfiguration: 'MongoDB Configuration',
    commonConfiguration: 'Database Configuration',
    expose: 'Expose',
    internetFacing: 'Internet Facing',
    sourceRange: 'Source Range',
  },
  resources: {
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    custom: 'Custom',
  },

  buttons: {
    addNew: 'Add new',
  },

  tooltips: {
    expose:
      'You will make this database cluster available to connect from the internet. To limit access you need to specify source ranges',
  },
  placeholders: {
    storageClass: 'storage class',
    sourceRange: '181.170.213.40/32',
  },
};
