import type { AppConfigureExtension, AppPluginExtensionLink } from '@grafana/data';

type Options = {
  pluginId: string;
  title: string;
  logger: (msg: string, error?: unknown) => void;
};

export function createLinkValidator(options: Options) {
  const { pluginId, title, logger } = options;

  return (configure: AppConfigureExtension<AppPluginExtensionLink>): AppConfigureExtension<AppPluginExtensionLink> => {
    return function validateLink(link, context) {
      const configured = configure(link, context);

      if (!isValidLinkPath(pluginId, configured?.path)) {
        logger(
          `[Plugins] Disabled extension '${title}' for '${pluginId}' beause configure didn't return a path with the correct prefix: '${`/a/${pluginId}/`}'`
        );
        return undefined;
      }

      return configured;
    };
  };
}

export function isValidLinkPath(pluginId: string, path?: string): boolean {
  return path?.startsWith(`/a/${pluginId}/`) === true;
}
