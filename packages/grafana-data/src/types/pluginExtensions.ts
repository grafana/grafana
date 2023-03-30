/**
 * These types are exposed when rendering extension points
 */

export enum PluginExtensionPlacements {
  DashboardPanelMenu = 'grafana/dashboard/panel/menu',
}

export enum PluginExtensionTypes {
  link = 'link',
  command = 'command',
}

export type PluginExtension = {
  type: PluginExtensionTypes;
  title: string;
  description: string;
  key: number;
};

export type PluginExtensionLink = PluginExtension & {
  type: PluginExtensionTypes.link;
  path: string;
};

export type PluginExtensionCommand = PluginExtension & {
  type: PluginExtensionTypes.command;
  callHandlerWithContext: () => void;
};

export function isPluginExtensionLink(extension: PluginExtension | undefined): extension is PluginExtensionLink {
  if (!extension) {
    return false;
  }
  return extension.type === PluginExtensionTypes.link && 'path' in extension;
}

export function assertPluginExtensionLink(
  extension: PluginExtension | undefined
): asserts extension is PluginExtensionLink {
  if (!isPluginExtensionLink(extension)) {
    throw new Error(`extension is not a link extension`);
  }
}

export function isPluginExtensionCommand(extension: PluginExtension | undefined): extension is PluginExtensionCommand {
  if (!extension) {
    return false;
  }
  return extension.type === PluginExtensionTypes.command;
}

export function assertPluginExtensionCommand(
  extension: PluginExtension | undefined
): asserts extension is PluginExtensionCommand {
  if (!isPluginExtensionCommand(extension)) {
    throw new Error(`extension is not a command extension`);
  }
}

export function extensionLinkConfigIsValid(props: {
  path?: string;
  description?: string;
  title?: string;
  placement?: string;
}) {
  const valuesAreStrings = Object.values(props).every((val) => typeof val === 'string' && val.length);
  const placementIsValid = props.placement?.startsWith('grafana/') || props.placement?.startsWith('plugins/');
  return valuesAreStrings && placementIsValid;
}
