export enum AdvancedOptionsFields {
  nodes = 'nodes',
  resources = 'resources',
  memory = 'memory',
  cpu = 'cpu',
  disk = 'disk',
  template = 'template',
}

export enum DBClusterResources {
  small = 'small',
  medium = 'medium',
  large = 'large',
  custom = 'custom',
}

export interface DBClusterDefaultResources {
  [key: string]: {
    memory: number;
    cpu: number;
    disk: number;
  };
}
