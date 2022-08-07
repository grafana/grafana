declare let __webpack_public_path__: string;

// This is a path to the public folder without '/build'
window.__grafana_public_path__ =
  __webpack_public_path__.substring(0, __webpack_public_path__.lastIndexOf('build/')) || __webpack_public_path__;

import React from 'react';
import ReactDOM from 'react-dom';

import { toggleTheme } from 'app/core/services/toggleTheme';
import fn_app from 'app/fn_app';

class createMfe {
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
      console.log('react app bootstraped');
    };
  }

  static mountFnApp(component: React.component) {
    // eslint-disable-next-line
    return async function mount(props: any) {
      toggleTheme(props.theme);
      console.log('props', props);
      await fn_app.init();
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
