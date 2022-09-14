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
import fn_app from 'app/fn_app';

import { FnGlobalState } from '../core/reducers/fn-slice';

import { FNDashboardProps, FailedToMountGrafanaErrorName } from './types';

/**
 * NOTE:
 * Qiankun expects Promise. Otherwise warnings are logged nad life cycle hooks do not work
 */
/* eslint-disable-next-line  */
type LifeCycleFn<R = any, A extends any[] = any[]> = (...args: A) => Promise<R>;

class createMfe {
  private static readonly containerSelector = '#grafanaRoot';

  private static readonly logPrefix = '[FN Grafana]';

  theme: FNDashboardProps['theme'];

  constructor(readonly props: FNDashboardProps) {
    this.theme = props.theme;
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  private static logger = (...args: any[]) => console.log(createMfe.logPrefix, ...args);

  static create(component: ComponentType<FNDashboardProps>) {
    return {
      bootstrap: this.boot(),
      mount: this.mountFnApp(component),
      unmount: this.unMountFnApp(),
      update: this.updateFnApp(),
    };
  }

  static boot() {
    return async () => {
      await fn_app.init();
    };
  }

  private loadFnTheme() {
    const theme = this.theme;

    createMfe.logger('Trying to load theme...', theme);

    config.theme2 = createTheme({
      colors: {
        mode: theme,
      },
    });
    config.theme = config.theme2.v1;
    config.bootData.user.lightTheme = theme === 'light' ? true : false;
    appEvents.publish(new ThemeChangedEvent(config.theme2));
    const other = theme === 'dark' ? 'light' : 'dark';
    const newCssLink = document.createElement('link');
    newCssLink.rel = 'stylesheet';
    newCssLink.href = config.bootData.themePaths[theme];
    document.body.appendChild(newCssLink);
    const bodyLinks = document.getElementsByTagName('link');
    for (let i = 0; i < bodyLinks.length; i++) {
      const link = bodyLinks[i];
      if (link.href && link.href.indexOf(`build/grafana.${other}`) > 0) {
        link.remove();
      }
    }

    createMfe.logger('Successfully loaded theme:', theme);
  }

  private static getContainer(props: FNDashboardProps) {
    const parentElement = props.container || document;

    return parentElement.querySelector(createMfe.containerSelector);
  }

  private get container() {
    return createMfe.getContainer(this.props);
  }

  static mountFnApp(component: ComponentType<FNDashboardProps>) {
    const lifeCycleFn: LifeCycleFn = (props: FNDashboardProps) => {
      return new Promise((res, rej) => {
        createMfe.logger('Trying to mount grafana...');

        try {
          const mfe = new createMfe(props);

          mfe.loadFnTheme();

          ReactDOM.render(React.createElement(component, { ...props }), mfe.container, () => {
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
    const lifeCycleFn: LifeCycleFn = (props: FNDashboardProps) => {
      const container = createMfe.getContainer(props);

      if (container) {
        createMfe.logger('Trying to unmount grafana...');
        ReactDOM.unmountComponentAtNode(container);
        createMfe.logger('Successfully unmounted grafana.');

        return Promise.resolve(true);
      } else {
        const message = '[Failed to unmount grafana. Container does not exist.';
        createMfe.logger(message);

        // TODO: I'm not sure what would break so I leave the target implementation in the comment
        // return Promise.reject(new Error(message));
        return Promise.resolve(false);
      }
    };

    return lifeCycleFn;
  }

  static updateFnApp() {
    const lifeCycleFn: LifeCycleFn = (props: FnGlobalState) => {
      createMfe.logger('Trying to update grafana...');

      return Promise.resolve(false);
    };

    return lifeCycleFn;
  }
}

export { createMfe };
