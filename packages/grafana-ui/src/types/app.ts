import { ComponentClass } from 'react';
import { NavModel } from './navModel';
import { PluginMeta, PluginIncludeType, GrafanaPlugin } from './plugin';

export interface AppRootProps {
  meta: AppPluginMeta;

  path: string; // The URL path to this page
  query: { [s: string]: any }; // The URL query parameters

  /**
   * Pass the nav model to the container... is there a better way?
   */
  onNavChanged: (nav: NavModel) => void;
}

export interface AppPluginMeta extends PluginMeta {
  // TODO anything specific to apps?
}

export class AppPlugin extends GrafanaPlugin<AppPluginMeta> {
  // Content under: /a/${plugin-id}/*
  root?: ComponentClass<AppRootProps>;
  rootNav?: NavModel; // Initial navigation model

  // Old style pages
  angularPages?: { [component: string]: any };

  /**
   * Called after the module has loaded, and before the app is used.
   * This function may be called multiple times on the same instance.
   * The first time, `this.meta` will be undefined
   */
  init(meta: AppPluginMeta) {}

  /**
   * Set the component displayed under:
   *   /a/${plugin-id}/*
   */
  setRootPage(root: ComponentClass<AppRootProps>, rootNav?: NavModel) {
    this.root = root;
    this.rootNav = rootNav;
    return this;
  }

  setComponentsFromLegacyExports(pluginExports: any) {
    if (pluginExports.ConfigCtrl) {
      this.angularConfigCtrl = pluginExports.ConfigCtrl;
    }

    const { meta } = this;
    if (meta && meta.includes) {
      for (const include of meta.includes) {
        const { type, component } = include;
        if (type === PluginIncludeType.page && component) {
          const exp = pluginExports[component];
          if (!exp) {
            console.warn('App Page uses unknown component: ', component, meta);
            continue;
          }
          if (!this.angularPages) {
            this.angularPages = {};
          }
          this.angularPages[component] = exp;
        }
      }
    }
  }
}
