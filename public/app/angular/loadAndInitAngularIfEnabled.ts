import { config, setAngularLoader } from '@grafana/runtime';

export async function loadAndInitAngularIfEnabled() {
  if (config.angularSupportEnabled) {
    // const { AngularApp } = await import(/* webpackChunkName: "AngularApp" */ './index');
    // const app = new AngularApp();
    // app.init();
    // app.bootstrap();
  } else {
    setAngularLoader({
      load: (elem, scopeProps, template) => {
        return {
          destroy: () => {},
          digest: () => {},
          getScope: () => {
            return {};
          },
        };
      },
    });
  }
}
