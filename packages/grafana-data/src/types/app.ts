import { isFunction, isObject } from 'lodash';
import { ComponentType } from 'react';

import { KeyValue } from './data';
import { NavModel } from './navModel';
import { PluginMeta, GrafanaPlugin, PluginIncludeType } from './plugin';
import { LinkExtensionConfigurer } from './pluginExtensions';

/**
 * @public
 * The app container that is loading another plugin (panel or query editor)
 * */
export enum CoreApp {
  CloudAlerting = 'cloud-alerting',
  UnifiedAlerting = 'unified-alerting',
  Dashboard = 'dashboard',
  Explore = 'explore',
  Correlations = 'correlations',
  Unknown = 'unknown',
  PanelEditor = 'panel-editor',
  PanelViewer = 'panel-viewer',
}

export interface AppRootProps<T extends KeyValue = KeyValue> {
  meta: AppPluginMeta<T>;
  /**
   * base URL segment for an app, /app/pluginId
   */
  basename: string; // The URL path to this page

  /**
   * Pass the nav model to the container... is there a better way?
   * @deprecated Use PluginPage component exported from @grafana/runtime instead
   */
  onNavChanged: (nav: NavModel) => void;

  /**
   * The URL query parameters
   * @deprecated Use react-router instead
   */
  query: KeyValue;

  /**
   * The URL path to this page
   * @deprecated Use react-router instead
   */
  path: string;
}

export interface AppPluginMeta<T extends KeyValue = KeyValue> extends PluginMeta<T> {
  // TODO anything specific to apps?
}

export class AppPlugin<T extends KeyValue = KeyValue> extends GrafanaPlugin<AppPluginMeta<T>> {
  // Content under: /a/${plugin-id}/*
  root?: ComponentType<AppRootProps<T>>;
  extensionConfigs: Record<string, LinkExtensionConfigurer> = {};

  /**
   * Called after the module has loaded, and before the app is used.
   * This function may be called multiple times on the same instance.
   * The first time, `this.meta` will be undefined
   */
  init(meta: AppPluginMeta) {}

  /**
   * Set the component displayed under:
   *   /a/${plugin-id}/*
   *
   * If the NavModel is configured, the page will have a managed frame, otheriwse it has full control.
   */
  setRootPage(root: ComponentType<AppRootProps<T>>) {
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
        }
      }
    }
  }

  configureExtensionLink<P extends object>(id: string, configure: LinkExtensionConfigurer<P>) {
    this.extensionConfigs[id] = configureWithErrorHandling(id, configure);
    return this;
  }
}

/**
 * Defines life cycle of a feature
 * @internal
 */
export enum FeatureState {
  alpha = 'alpha',
  beta = 'beta',
}

function configureWithErrorHandling<T extends object>(
  id: string,
  configurer: LinkExtensionConfigurer<T>
): LinkExtensionConfigurer {
  return function configureLinkExtension(link, context) {
    try {
      if (!isFunction(configurer)) {
        console.error(`[PluginExtensions] Invalid configuration function provided for extension '${id}'.`);
        return;
      }

      const result = configurer(link, context as T);
      if (result instanceof Promise) {
        console.error(
          `[PluginExtensions] Can't configure extension '${id}' with an async/promise-based configuration function.`
        );
        result.catch(() => {});
        return;
      }

      if (!isObject(result) && !undefined) {
        console.error(
          `[PluginExtensions] Will not configure extension '${id}' due to invalid override returned from configuration function.`
        );
        return;
      }

      return result;
    } catch (error) {
      console.error(`[PluginExtensions] Error occured while configure extension '${id}'`, error);
      return;
    }
  };
}
