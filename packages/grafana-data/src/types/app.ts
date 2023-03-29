import { ComponentType } from 'react';

import { KeyValue } from './data';
import { NavModel } from './navModel';
import { PluginMeta, GrafanaPlugin, PluginIncludeType } from './plugin';
import { extensionLinkConfigIsValid, type PluginExtensionCommand, type PluginExtensionLink } from './pluginExtensions';

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

/**
 * The `configure()` function can only update certain properties of the extension, and due to this
 * it only receives a subset of the original extension object.
 */
export type AppPluginExtensionLink = Pick<PluginExtensionLink, 'description' | 'path' | 'title'>;

// A list of helpers that can be used in the command handler
export type AppPluginExtensionCommandHelpers = {
  // Opens a modal dialog and renders the provided React component inside it
  openModal: (options: {
    // The title of the modal
    title: string;
    // A React element that will be rendered inside the modal
    body: React.ElementType<{ onDismiss?: () => void }>;
  }) => void;
};

export type AppPluginExtensionCommand = Pick<PluginExtensionCommand, 'description' | 'title'>;

export type AppPluginExtensionLinkConfig<C extends object = object> = {
  title: string;
  description: string;
  placement: string;
  path: string;
  configure?: (context?: C) => Partial<AppPluginExtensionLink> | undefined;
};

export type AppPluginExtensionCommandConfig<C extends object = object> = {
  title: string;
  description: string;
  placement: string;
  handler: (context?: C, helpers?: AppPluginExtensionCommandHelpers) => void;
  configure?: (context?: C) => Partial<AppPluginExtensionCommand> | undefined;
};

export class AppPlugin<T extends KeyValue = KeyValue> extends GrafanaPlugin<AppPluginMeta<T>> {
  private linkExtensions: AppPluginExtensionLinkConfig[] = [];
  private commandExtensions: AppPluginExtensionCommandConfig[] = [];

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

  get extensionLinks(): AppPluginExtensionLinkConfig[] {
    return this.linkExtensions;
  }

  get extensionCommands(): AppPluginExtensionCommandConfig[] {
    return this.commandExtensions;
  }

  configureExtensionLink<C extends object>(config: AppPluginExtensionLinkConfig<C>) {
    const { path, description, title, placement } = config;

    if (!extensionLinkConfigIsValid({ path, description, title, placement })) {
      console.warn('[Plugins] Disabled extension because configureExtensionLink was called with an invalid object.');
      return this;
    }

    this.linkExtensions.push(config as AppPluginExtensionLinkConfig);
    return this;
  }

  configureExtensionCommand<C extends object>(config: AppPluginExtensionCommandConfig<C>) {
    this.commandExtensions.push(config as AppPluginExtensionCommandConfig);
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
