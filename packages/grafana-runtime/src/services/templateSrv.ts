import { VariableModel } from '@grafana/data';

export interface TemplateSrv {
  getVariables(): VariableModel[];
}

let singletonInstance: TemplateSrv;

export const setTemplateSrv = (instance: TemplateSrv) => {
  singletonInstance = instance;
};

export const getTemplateSrv = (): TemplateSrv => singletonInstance;
