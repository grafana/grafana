import { ComponentClass, ComponentType } from 'react';
import { KeyValue } from './data';
import { NavModel } from './navModel';
import { PluginMeta, GrafanaPlugin, PluginIncludeType } from './plugin';
import { UrlQueryMap } from '../utils';

export enum CoreApp {
  Dashboard = 'dashboard',
  Explore = 'explore',
}

export interface AppRootProps<T = KeyValue> {
  meta: AppPluginMeta<T>;

  path: string; // The URL path to this page
  query: KeyValue; // The URL query parameters
}

export interface AppPluginMeta<T = KeyValue> extends PluginMeta<T> {
  // TODO anything specific to apps?
}

export class AppPlugin<T = KeyValue> extends GrafanaPlugin<AppPluginMeta<T>> {
  // Content under: /a/${plugin-id}/*
  root?: ComponentType<AppRootProps<T>>;

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
  setRootPage(root: ComponentClass<AppRootProps<T>>) {
    this.root = root;
    return this;
  }

  setComponentsFromLegacyExports(pluginExports: any) {
    if (pluginExports.ConfigCtrl) {
      this.angularConfigCtrl = pluginExports.ConfigCtrl;
    }

    if (this.meta && this.meta.includes) {
      for (const include of this.meta.includes) {
        if (include.type === PluginIncludeType.page && include.component) {
          const exp = pluginExports[include.component];

          if (!exp) {
            console.warn('App Page uses unknown component: ', include.component, this.meta);
            continue;
          }

          if (!this.angularPages) {
            this.angularPages = {};
          }

          this.angularPages[include.component] = exp;
        }
      }
    }
  }
}

export interface PluginPageRouteProps {
  path: string;
  component: ComponentType;
  /*
   * If nav model then the component get's rendered inside a page & page contents
   * If not then the component can control full page style
   */
  navModel?: NavModel;
}

export interface PluginPageRouterProps {}

export class PluginPageRouter {
  static Router: ComponentType<PluginPageRouterProps> = (props: PluginPageRouterProps) => null;
  static Route: ComponentType<PluginPageRouteProps> = (props: PluginPageRouteProps) => null;
}

/**
 * Defines life cycle of a feature
 * @internal
 */
export enum FeatureState {
  alpha = 'alpha',
  beta = 'beta',
}
