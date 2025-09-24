import jquery from 'jquery';
import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.stack';
import 'vendor/flot/jquery.flot.stackpercent';
import 'vendor/flot/jquery.flot.fillbelow';
import 'vendor/flot/jquery.flot.crosshair';
import 'vendor/flot/jquery.flot.dashes';
import 'vendor/flot/jquery.flot.gauge';

import * as grafanaData from '@grafana/data';
import * as grafanaRuntime from '@grafana/runtime';
// eslint-disable-next-line no-restricted-imports
import * as grafanaUIraw from '@grafana/ui';
import TableModel from 'app/core/TableModel';
import config from 'app/core/config';
import { appEvents, contextSrv } from 'app/core/core';
import { BackendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import TimeSeries from 'app/core/time_series2';
import { arrayMove } from 'app/core/utils/arrayMove';
import * as flatten from 'app/core/utils/flatten';
import kbn from 'app/core/utils/kbn';
import * as ticks from 'app/core/utils/ticks';

// Help the 6.4 to 6.5 migration
// The base classes were moved from @grafana/ui to @grafana/data
// This exposes the same classes on both import paths
const grafanaUI: Record<string, unknown> = grafanaUIraw;
grafanaUI.PanelPlugin = grafanaData.PanelPlugin;
grafanaUI.DataSourcePlugin = grafanaData.DataSourcePlugin;
grafanaUI.AppPlugin = grafanaData.AppPlugin;
grafanaUI.DataSourceApi = grafanaData.DataSourceApi;

const jQueryFlotDeps = [
  'jquery.flot.crosshair',
  'jquery.flot.events',
  'jquery.flot.fillbelow',
  'jquery.flot.gauge',
  'jquery.flot.pie',
  'jquery.flot.selection',
  'jquery.flot.stack',
  'jquery.flot.stackpercent',
  'jquery.flot.time',
  'jquery.flot',
].reduce((acc, flotDep) => ({ ...acc, [flotDep]: { fakeDep: 1 } }), {});

export const sharedDependenciesMap = {
  '@emotion/css': () => import('@emotion/css'),
  '@emotion/react': () => import('@emotion/react'),
  '@grafana/data': grafanaData,
  '@grafana/data/unstable': () => import('@grafana/data/unstable'),
  '@grafana/runtime': grafanaRuntime,
  '@grafana/runtime/unstable': () => import('@grafana/runtime/unstable'),
  '@grafana/slate-react': () => import('slate-react'),
  '@grafana/ui': grafanaUI,
  '@grafana/ui/unstable': () => import('@grafana/ui/unstable'),
  '@kusto/monaco-kusto': () => import('@kusto/monaco-kusto'),
  'app/core/app_events': {
    default: appEvents,
    __useDefault: true,
  },
  'app/core/config': {
    default: config,
    __useDefault: true,
  },
  'app/core/core': {
    appEvents: appEvents,
    contextSrv: contextSrv,
  },
  'app/core/services/backend_srv': {
    BackendSrv,
    getBackendSrv,
  },
  'app/core/table_model': { default: TableModel, __useDefault: true },
  'app/core/time_series': { default: TimeSeries, __useDefault: true },
  'app/core/time_series2': { default: TimeSeries, __useDefault: true },
  'app/core/utils/datemath': grafanaData.dateMath,
  'app/core/utils/flatten': flatten,
  'app/core/utils/kbn': {
    default: kbn,
    __useDefault: true,
  },
  'app/core/utils/ticks': ticks,
  'app/features/dashboard/impression_store': {
    impressions: impressionSrv,
  },
  d3: () => import('d3'),
  emotion: () => import('@emotion/css'),
  // bundling grafana-ui in plugins requires sharing i18next state
  i18next: () => import('@grafana/i18n/internal').then((module) => module.getI18nInstance()),
  jquery: {
    default: jquery,
    __useDefault: true,
  },
  ...jQueryFlotDeps,
  // add move to lodash for backward compatabilty with plugins
  lodash: () => import('lodash').then((module) => ({ ...module, move: arrayMove, __useDefault: true })),
  moment: () => import('moment').then((module) => ({ ...module, __useDefault: true })),
  prismjs: () => import('prismjs'),
  react: () => import('react'),
  'react-dom': () => import('react-dom'),
  // bundling grafana-ui in plugins requires sharing react-inlinesvg for the icon cache
  'react-inlinesvg': () => import('react-inlinesvg'),
  'react-redux': () => import('react-redux'),
  // Migration - React Router v5 -> v6
  // =================================
  // Plugins that still use "react-router-dom@v5" don't depend on react-router directly, so they will not use this import.
  // (The react-router-dom@v5 that we expose for them depends on the "react-router" package internally from core.)
  //
  // Plugins that would like update to "react-router-dom@v6" will need to bundle "react-router-dom",
  // however they cannot bundle "react-router" - this would mean that we have two instances of "react-router"
  // in the app, which would casue issues. As the "react-router-dom-v5-compat" package re-exports everything from "react-router-dom@v6"
  // which then re-exports everything from "react-router@v6", we are in the lucky state to be able to expose a compatible v6 version of the router to plugins by
  // just exposing "react-router-dom-v5-compat".
  //
  // (This means that we are exposing two versions of the same package).
  'react-router-dom': () => import('react-router-dom'),
  'react-router': () => import('react-router-dom-v5-compat'),
  redux: () => import('redux'),
  rxjs: () => import('rxjs'),
  'rxjs/operators': () => import('rxjs/operators'),
  slate: () => import('slate'),
  'slate-plain-serializer': () => import('slate-plain-serializer'),
  'slate-react': () => import('slate-react'),
};
