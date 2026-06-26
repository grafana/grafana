import { template } from 'lodash';

import { RawTimeRange, PanelPluginMeta, dateMath } from '@grafana/data';
import config from 'app/core/config';
import { ContextSrv } from 'app/core/services/context_srv';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

export function ControllerTestContext(this: any) {
  const self = this;

  this.datasource = {};
  this.$element = {};
  this.$sanitize = {};
  this.annotationsSrv = {};
  this.contextSrv = {};
  this.timeSrv = new TimeSrvStub();
  this.templateSrv = TemplateSrvStub();
  this.datasourceSrv = {
    getMetricSources: () => {},
    get: () => {
      return {
        then: (callback: (ds: any) => void) => {
          callback(self.datasource);
        },
      };
    },
  };
  this.isUtc = false;

  this.createPanelController = (Ctrl: any) => {
    return () => {
      self.panel = new PanelModel({ type: 'test' });
      self.dashboard = { meta: {} };
      self.isUtc = false;
      self.dashboard.getTimezone = () => {
        return self.isUtc ? 'utc' : 'browser';
      };
      config.panels['test'] = { info: {} } as PanelPluginMeta;
    };
  };

  this.setIsUtc = (isUtc = false) => {
    self.isUtc = isUtc;
  };
}

export function DashboardViewStateStub(this: any) {
  this.registerPanel = () => {};
}

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

export function TemplateSrvStub(this: any) {
  this.variables = [];
  this.getVariables = function () {
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
  this.setGrafanaVariable = function (name: string, value: string) {
    this.data[name] = value;
  };
}

const allDeps = {
  ContextSrvStub,
  TemplateSrvStub,
  TimeSrvStub,
  ControllerTestContext,
  DashboardViewStateStub,
};

// for legacy
export default allDeps;
