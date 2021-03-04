import { DataConfigSource, QueryRunner } from '@grafana/data';

export type QueryRunnerFactory = (config: DataConfigSource) => QueryRunner;

let instance: QueryRunnerFactory;

export const setQueryRunnerFactory = (factory: QueryRunnerFactory): void => {
  instance = factory;
};

export const createQueryRunner = (config: DataConfigSource): QueryRunner => {
  if (!instance) {
    throw new Error('createQueryRunner can only be called after grafana instance has been started.');
  }
  return instance(config);
};
