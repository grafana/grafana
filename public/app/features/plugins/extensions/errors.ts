export const INVALID_EXTENSION_POINT_ID =
  'Invalid usage of extension point. Reason: Extension point id should be prefixed with your plugin id, e.g "myorg-foo-app/toolbar/v1". Returning an empty array of extensions.';

export const INVALID_EXTENSION_POINT_ID_PLUGIN = (pluginId: string, extensionPointId: string) =>
  `Invalid usage of extension point. Reason: Extension point id should be prefixed with your plugin id, e.g "${pluginId}/${extensionPointId}".`;

export const INVALID_EXTENSION_POINT_ID_GRAFANA_PREFIX = (extensionPointId: string) =>
  `Invalid usage of extension point. Reason: Core Grafana extension point id should be prefixed with "grafana/", e.g "grafana/${extensionPointId}".`;

export const INVALID_EXTENSION_POINT_ID_GRAFANA_EXPOSED = `Invalid usage of extension point. Reason: Core Grafana extension point id should be exposed to plugins via the "PluginExtensionPoints" enum in the "grafana-data" package (/packages/grafana-data/src/types/pluginExtensions.ts).`;

export const EXTENSION_POINT_META_INFO_MISSING =
  'Invalid usage of extension point. Reason: The extension point is not recorded in the "plugin.json" file. Extension points must be listed in the section "extensions.extensionPoints[]". Returning an empty array of extensions.';

export const TITLE_MISSING = 'Title is missing.';

export const DESCRIPTION_MISSING = 'Description is missing.';

export const INVALID_EXTENSION_FUNCTION = 'The "fn" argument is invalid, it should be a function.';

export const INVALID_CONFIGURE_FUNCTION = 'The "configure" function is invalid. It should be a function.';

export const INVALID_PATH_OR_ON_CLICK = 'Either "path" or "onClick" is required.';

export const INVALID_PATH = 'The "path" is required and should start with "/a/<pluginId>".';

export const INVALID_EXPOSED_COMPONENT_ID =
  "The component id does not match the id naming convention. Id should be prefixed with plugin id. e.g 'myorg-basic-app/my-component-id/v1'.";

export const EXPOSED_COMPONENT_ALREADY_EXISTS = 'An exposed component with the same id already exists.';

export const EXPOSED_COMPONENT_META_INFO_MISSING =
  'The exposed component was not recorded in the plugin.json. Exposed component extensions must be listed in the section "extensions.exposedComponents[]". Currently, this is only required in development but will be enforced also in production builds in the future.';

export const EXPOSED_COMPONENT_DEPENDENCY_MISSING =
  'Invalid usage of extension point. Reason: The exposed component is not recorded in the "plugin.json" file. Exposed components must be listed in the dependencies[] section.';

export const ADDED_COMPONENT_META_INFO_MISSING =
  'The extension was not recorded in the plugin.json. Added component extensions must be listed in the section "extensions.addedComponents[]". Currently, this is only required in development but will be enforced also in production builds in the future.';

export const TITLE_NOT_MATCHING_META_INFO = 'The "title" doesn\'t match the title recorded in plugin.json.';

export const ADDED_LINK_META_INFO_MISSING =
  'The extension was not recorded in the plugin.json. Added link extensions must be listed in the section "extensions.addedLinks[]". Currently, this is only required in development but will be enforced also in production builds in the future.';

export const ADDED_FUNCTION_META_INFO_MISSING =
  'The extension was not recorded in the plugin.json. Added function extensions must be listed in the section "extensions.addedFunction[]". Currently, this is only required in development but will be enforced also in production builds in the future.';

export const DESCRIPTION_NOT_MATCHING_META_INFO =
  'The "description" doesn\'t match the description recorded in plugin.json.';

export const TARGET_NOT_MATCHING_META_INFO =
  'The "targets" for the registered extension does not match the targets recorded in plugin.json. Currently, this is only required in development but will be enforced also in production builds in the future.';

export const APP_NOT_FOUND = (pluginId: string) => `The app plugin with plugin id "${pluginId}" was not found.`;
