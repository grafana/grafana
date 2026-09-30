import { template } from 'lodash';

import { type RawTimeRange, dateMath } from '@grafana/data';
import { ContextSrv } from 'app/core/services/context_srv';

export class TimeSrvStub {
  time: RawTimeRange;

  constructor() {
    this.time = { from: 'now-1h', to: 'now' };
  }

  init() {}

  timeRange(parse: boolean) {
    if (parse === false) {
      return this.time;
    }
    return {
      from: dateMath.parse(this.time.from, false),
      to: dateMath.parse(this.time.to, true),
    };
  }

  setTime(time: RawTimeRange) {
    this.time = time;
  }
}

export class ContextSrvStub extends ContextSrv {
  isGrafanaVisible = jest.fn();

  getValidInterval() {
    return '10s';
  }

  hasRole() {
    return true;
  }

  isAllowedInterval() {
    return true;
  }
}

interface TemplateSrvStubInstance {
  variables: unknown[];
  getVariables(): unknown[];
  templateSettings: { interpolate: RegExp };
  data: Record<string, string>;
  replace(text: string): string;
  init(): void;
  getAdhocFilters(): unknown[];
  fillVariableValuesForUrl(): void;
  updateIndex(): void;
  containsTemplate(): boolean;
  variableInitialized(): void;
  highlightVariablesAsHtml(str: string): string;
  setGrafanaVariable(name: string, value: string): void;
}

export function TemplateSrvStub(this: TemplateSrvStubInstance) {
  this.variables = [];
  this.getVariables = function (this: TemplateSrvStubInstance) {
    return this.variables;
  };
  this.templateSettings = { interpolate: /\[\[([\s\S]+?)\]\]/g };
  this.data = {};
  this.replace = (text: string) => {
    return template(text, this.templateSettings)(this.data);
  };
  this.init = () => {};
  this.getAdhocFilters = () => {
    return [];
  };
  this.fillVariableValuesForUrl = () => {};
  this.updateIndex = () => {};
  this.containsTemplate = () => {
    return false;
  };
  this.variableInitialized = () => {};
  this.highlightVariablesAsHtml = (str: string) => {
    return str;
  };
  this.setGrafanaVariable = function (this: TemplateSrvStubInstance, name: string, value: string) {
    this.data[name] = value;
  };
}

const allDeps = {
  ContextSrvStub,
  TemplateSrvStub,
  TimeSrvStub,
};

// for legacy
export default allDeps;
