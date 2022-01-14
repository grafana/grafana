export enum DBClusterTopology {
  cluster = 'cluster',
  single = 'single',
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
