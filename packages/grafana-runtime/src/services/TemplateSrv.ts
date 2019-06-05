import { TimeRange, ScopedVars, KeyValue } from '@grafana/ui';

export interface TemplateSrv {
  variables: any[];
  init(variables: any[], timeRange?: TimeRange): void;
  fillVariableValuesForUrl(params: KeyValue<string>, scopedVars?: ScopedVars): void;
  highlightVariablesAsHtml(text?: string): string;
  replaceWithText(target: string, scopedVars: ScopedVars): string;
  replace(target: string, scopedVars?: ScopedVars, format?: string | Function): string;
  setGrafanaVariable(name: string, value: any): void;
  updateIndex(): void;
  updateTimeRange(timeRange: TimeRange): void;
  variableInitialized(variable: any): void;
}

let singletonInstance: TemplateSrv;

export function setTemplateSrv(instance: TemplateSrv) {
  singletonInstance = instance;
}

export function getTemplateSrv(): TemplateSrv {
  return singletonInstance;
}
