declare let __webpack_public_path__: string;

// This is a path to the public folder without '/build'
window.__grafana_public_path__ =
  __webpack_public_path__.substring(0, __webpack_public_path__.lastIndexOf('build/')) || __webpack_public_path__;

import React from 'react';
import ReactDOM from 'react-dom';

import { createTheme } from '@grafana/data';
import { ThemeChangedEvent } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';
import { toggleTheme } from 'app/core/services/toggleTheme';
import fn_app from 'app/fn_app';

class createMfe {
  constructor(public theme: string) {
    this.theme = theme;
  }
  static create(component: React.Component) {
    return {
      bootstrap: this.boot(),
      mount: this.mountFnApp(component),
      unmount: this.unMountFnApp(),
      update: this.updateFnApp(),
    };
  }

  static boot() {
    // eslint-disable-next-line
    return async function bootstrap() {
      await fn_app.init();
      console.log('grafana app bootstraped');
    };
  }

  loadFnTheme() {
    const theme = this.theme;
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
      if (link.href) {
        console.log(link.href, 'href');
      }
      if (link.href && link.href.indexOf(`build/grafana.${other}`) > 0) {
        // Remove existing link after a 500ms to allow new css to load to avoid flickering
        // If we add new css at the same time we remove current one the page will be rendered without css
        // As the new css file is loading
        setTimeout(() => link.remove(), 500);
      }
    }
  }

  static mountFnApp(component: React.Component) {
    // eslint-disable-next-line
    return async function mount(props: any) {
      const mfe = new createMfe(props.theme);
      mfe.loadFnTheme();
      ReactDOM.render(
        React.createElement(component, { ...props }),
        props.container ? props.container.querySelector('#reactRoot') : document.getElementById('reactRoot')
      );
    };
  }

  static unMountFnApp() {
    // eslint-disable-next-line
    return async function unmount(props: any) {
      const container = props.container
        ? props.container.querySelector('#reactRoot')
        : document.getElementById('reactRoot');
      if (container) {
        ReactDOM.unmountComponentAtNode(container);
      }
      console.log('unmounting grafana app', props);
    };
  }

  static updateFnApp() {
    // eslint-disable-next-line
    return async function update(props: any) {
      console.log('update props', props);
    };
  }
}

export { createMfe };
