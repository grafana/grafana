declare let __webpack_public_path__: string;

// This is a path to the public folder without '/build'
window.__grafana_public_path__ =
  __webpack_public_path__.substring(0, __webpack_public_path__.lastIndexOf('build/')) || __webpack_public_path__;

import React, { ComponentType } from 'react';
import ReactDOM from 'react-dom';

import { createTheme } from '@grafana/data';
import { ThemeChangedEvent } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';
import fn_app from 'app/fn_app';

import { FNDashboardProps, FailedToMountGrafanaErrorName } from './types';

/**
 * NOTE:
 * Qiankun expects Promise. Otherwise warnings are logged and life cycle hooks do not work
 */
/* eslint-disable-next-line  */
export declare type LifeCycleFn<T extends { [key: string]: any }> = (app: any, global: typeof window) => Promise<any>;

/**
 * NOTE: single-spa and qiankun lifeCycles
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export declare type FrameworkLifeCycles<T = any> = {
  beforeLoad: LifeCycleFn<T> | Array<LifeCycleFn<T>>;
  beforeMount: LifeCycleFn<T> | Array<LifeCycleFn<T>>;
  afterMount: LifeCycleFn<T> | Array<LifeCycleFn<T>>;
  beforeUnmount: LifeCycleFn<T> | Array<LifeCycleFn<T>>;
  afterUnmount: LifeCycleFn<T> | Array<LifeCycleFn<T>>;
  bootstrap: LifeCycleFn<T> | Array<LifeCycleFn<T>>;
  mount: LifeCycleFn<T> | Array<LifeCycleFn<T>>;
  unmount: LifeCycleFn<T> | Array<LifeCycleFn<T>>;
  update: LifeCycleFn<T> | Array<LifeCycleFn<T>>;
};

class createMfe {
  private static readonly containerSelector = '#grafanaRoot';

  private static readonly logPrefix = '[FN Grafana]';

  mode: FNDashboardProps['mode'];
  static component: ComponentType<FNDashboardProps>;
  constructor(readonly props: FNDashboardProps) {
    this.mode = props.mode;
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  private static logger = (...args: any[]) => console.log(createMfe.logPrefix, ...args);

  static getLifeCycles(component: ComponentType<FNDashboardProps>) {
    const lifeCycles: FrameworkLifeCycles = {
      bootstrap: this.boot(),
      mount: this.mountFnApp(component),
      unmount: this.unMountFnApp(),
      update: this.updateFnApp(),
      afterMount: () => Promise.resolve(),
      beforeMount: () => Promise.resolve(),
      afterUnmount: () => Promise.resolve(),
      beforeUnmount: () => Promise.resolve(),
      beforeLoad: () => Promise.resolve(),
    };

    return lifeCycles;
  }

  static create(component: ComponentType<FNDashboardProps>) {
    return createMfe.getLifeCycles(component);
  }

  static boot() {
    return () => fn_app.init();
  }

  private static loadFnTheme = (mode: FNDashboardProps['mode']) => {
    createMfe.logger('Trying to load theme...', mode);

    config.theme2 = createTheme({
      colors: {
        mode,
      },
    });
    config.theme = config.theme2.v1;

    config.bootData.user.lightTheme = mode === 'light' ? true : false;
    appEvents.publish(new ThemeChangedEvent(config.theme2));
    const other = mode === 'dark' ? 'light' : 'dark';
    const newCssLink = document.createElement('link');
    newCssLink.rel = 'stylesheet';
    newCssLink.href = config.bootData.themePaths[mode];
    document.body.appendChild(newCssLink);
    const bodyLinks = document.getElementsByTagName('link');
    for (let i = 0; i < bodyLinks.length; i++) {
      const link = bodyLinks[i];
      if (link.href && link.href.indexOf(`build/grafana.${other}`) > 0) {
        link.remove();
      }
    }

    createMfe.logger('Successfully loaded theme:', mode);
  };

  private static getContainer(props: FNDashboardProps) {
    const parentElement = props.container || document;

    return parentElement.querySelector(createMfe.containerSelector);
  }

  static mountFnApp(component: ComponentType<FNDashboardProps>) {
    const lifeCycleFn: FrameworkLifeCycles['mount'] = (props: FNDashboardProps) => {
      return new Promise((res, rej) => {
        createMfe.logger('Trying to mount grafana...');

        try {
          createMfe.loadFnTheme(props.mode);
          createMfe.component = component;
          ReactDOM.render(React.createElement(component, { ...props }), createMfe.getContainer(props), () => {
            createMfe.logger('Successfully mounted grafana.');

            res(true);
          });
        } catch (err) {
          const message = `[FN Grafana]: Failed to mount grafana. ${err}`;

          console.log(message);

          const fnError = new Error(message);

          const name: FailedToMountGrafanaErrorName = 'FailedToMountGrafana';
          fnError.name = name;

          return rej(fnError);
        }
      });
    };

    return lifeCycleFn;
  }

  static unMountFnApp() {
    const lifeCycleFn: FrameworkLifeCycles['unmount'] = (props: FNDashboardProps) => {
      const container = createMfe.getContainer(props);

      if (container) {
        createMfe.logger('Trying to unmount grafana...');
        ReactDOM.unmountComponentAtNode(container);
        createMfe.logger('Successfully unmounted grafana.');
      } else {
        createMfe.logger('[Failed to unmount grafana. Container does not exist.');
      }

      backendSrv.cancelAllInFlightRequests();

      return Promise.resolve(!!container);
    };

    return lifeCycleFn;
  }

  static updateFnApp() {
    const lifeCycleFn: FrameworkLifeCycles['update'] = (props: FNDashboardProps) => {
      createMfe.logger('Trying to update grafana with theme:', props.mode);

      if (props.mode) {
        createMfe.loadFnTheme(props.mode);
        ReactDOM.render(React.createElement(createMfe.component, { ...props }), createMfe.getContainer(props), () => {
          createMfe.logger('Successfully mounted grafana.');
        });
      }

      return Promise.resolve(false);
    };

    return lifeCycleFn;
  }
}

export { createMfe };
