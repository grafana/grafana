import type { AppConfigureExtension, AppPluginExtensionLink } from '@grafana/data';

export function createLinkValidator(pluginId: string) {
  const pathPrefix = `/a/${pluginId}/`;

  return (configure: AppConfigureExtension<AppPluginExtensionLink>): AppConfigureExtension<AppPluginExtensionLink> => {
    return function validateLink(link, context) {
      const configured = configure(link, context);
      const path = configured?.path;

      if (path && !path.startsWith(pathPrefix)) {
        return undefined;
      }

      return configured;
    };
  };
}
