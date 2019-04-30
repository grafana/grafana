import { ComponentClass } from 'react';
import { NavModel } from './navModel';
import { PluginMeta, PluginWithConfig, PluginIncludeType, PluginMetaJsonData } from './plugin';

export interface AppRootProps {
  meta: AppMeta;

  path: string; // The URL path to this page
  query: { [s: string]: any }; // The URL query parameters

  /**
   * Pass the nav model to the container... is there a better way?
   */
  onNavChanged: (nav: NavModel) => void;
}

export interface AppMeta extends PluginMeta {
  // TODO anything specific to apps?
}

export class AppPlugin<TData extends PluginMetaJsonData = PluginMetaJsonData> extends PluginWithConfig<AppMeta, TData> {
  // Content under: /a/${plugin-id}/*
  root?: ComponentClass<AppRootProps>;
  rootNav?: NavModel; // Initial navigation model

  /**
   * Set the component displayed under:
   *   /a/${plugin-id}/*
   */
  setRootPage(root: ComponentClass<AppRootProps>, rootNav?: NavModel) {
    this.root = root;
    this.rootNav = rootNav;
    return this;
  }

  /**
   * Use PluginMeta to find relevant configs in include
   */
  initLegacyComponents(meta: AppMeta, pluginExports: any) {
    this.meta = meta;
    const legacy = {
      ConfigCtrl: undefined,
      pages: {} as any,
    };

    if (pluginExports.ConfigCtrl) {
      legacy.ConfigCtrl = pluginExports.ConfigCtrl;
      this.angular = legacy;
    }

    if (meta.includes) {
      // Find legacy config pages
      for (const include of meta.includes) {
        const { type, component } = include;
        if (type === PluginIncludeType.page && component) {
          const exp = pluginExports[component];
          if (!exp) {
            console.warn('Plugin references unknown component: ', component, meta);
            continue;
          }
          legacy.pages[component] = exp;
          this.angular = legacy;
        }
      }
    }
  }
}
