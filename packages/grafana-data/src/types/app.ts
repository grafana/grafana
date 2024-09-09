import { ComponentType } from 'react';

import { KeyValue } from './data';
import { NavModel } from './navModel';
import { PluginMeta, GrafanaPlugin, PluginIncludeType } from './plugin';
import {
  type PluginExtensionLinkConfig,
  PluginExtensionComponentConfig,
  PluginExtensionExposedComponentConfig,
  PluginExtensionAddedComponentConfig,
  PluginExtensionAddedLinkConfig,
} from './pluginExtensions';

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
  private _exposedComponentConfigs: PluginExtensionExposedComponentConfig[] = [];
  private _addedComponentConfigs: PluginExtensionAddedComponentConfig[] = [];
  private _addedLinkConfigs: PluginExtensionAddedLinkConfig[] = [];

  // Content under: /a/${plugin-id}/*
  root?: ComponentType<AppRootProps<T>>;

  /**
   * Called after the module has loaded, and before the app is used.
   * This function may be called multiple times on the same instance.
   * The first time, `this.meta` will be undefined
   */
  init(meta: AppPluginMeta<T>) {}

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

  get exposedComponentConfigs() {
    return this._exposedComponentConfigs;
  }

  get addedComponentConfigs() {
    return this._addedComponentConfigs;
  }

  get addedLinkConfigs() {
    return this._addedLinkConfigs;
  }

  addLink<Context extends object>(linkConfig: PluginExtensionAddedLinkConfig<Context>) {
    this._addedLinkConfigs.push(linkConfig as PluginExtensionAddedLinkConfig);

    return this;
  }

  addComponent<Props = {}>(addedComponentConfig: PluginExtensionAddedComponentConfig<Props>) {
    this._addedComponentConfigs.push(addedComponentConfig as PluginExtensionAddedComponentConfig);

    return this;
  }

  exposeComponent<Props = {}>(componentConfig: PluginExtensionExposedComponentConfig<Props>) {
    this._exposedComponentConfigs.push(componentConfig as PluginExtensionExposedComponentConfig);

    return this;
  }

  /** @deprecated Use .addLink() instead */
  configureExtensionLink<Context extends object>(extension: Omit<PluginExtensionLinkConfig<Context>, 'type'>) {
    this.addLink({
      targets: [extension.extensionPointId],
      ...extension,
    });

    return this;
  }
  /** @deprecated Use .addComponent() instead */
  configureExtensionComponent<Props = {}>(extension: Omit<PluginExtensionComponentConfig<Props>, 'type'>) {
    this.addComponent({
      targets: [extension.extensionPointId],
      ...extension,
      component: extension.component as ComponentType,
    });

    return this;
  }
}

/**
 * Defines life cycle of a feature
 * @internal
 */
export enum FeatureState {
  /** @deprecated in favor of experimental */
  alpha = 'alpha',
  /** @deprecated in favor of preview */
  beta = 'beta',
  /** used to mark experimental features with high/unknown risk */
  experimental = 'experimental',
  /** used to mark features that are in public preview with medium/hight risk */
  privatePreview = 'private preview',
  /** used to mark features that are in public preview with low/medium risk, or as a shared badge for public and private previews */
  preview = 'preview',
}
