import { css } from '@emotion/css';
import { Fragment } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, Stack, useStyles2 } from '@grafana/ui';

import { InstallControlsWarning } from '../components/InstallControls';
import { getLatestCompatibleVersion, hasInstallControlWarning } from '../helpers';
import { useInstallStatus, useIsRemotePluginsAvailable } from '../state/hooks';
import { CatalogPlugin, PluginStatus } from '../types';

interface Props {
  plugin?: CatalogPlugin;
}

type PluginSubtitleExtension = (props: Props) => JSX.Element | null;

const pluginSubtitleExtensions: PluginSubtitleExtension[] = [];

export const registerPluginSubtitleExtension = (extension: PluginSubtitleExtension) => {
  pluginSubtitleExtensions.push(extension);
};

export const PluginSubtitle = ({ plugin }: Props) => {
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const styles = useStyles2(getStyles);
  const { error: errorInstalling } = useInstallStatus();
  if (!plugin) {
    return null;
  }
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin.details?.versions);
  const pluginStatus = plugin.isInstalled
    ? plugin.hasUpdate
      ? PluginStatus.UPDATE
      : PluginStatus.UNINSTALL
    : PluginStatus.INSTALL;

  return (
    <div className={styles.subtitle}>
      {errorInstalling && (
        <Alert title={'message' in errorInstalling ? errorInstalling.message : ''}>
          {typeof errorInstalling === 'string' ? errorInstalling : errorInstalling.error}
        </Alert>
      )}
      <Stack direction="row" justifyContent="space-between">
        <div>
          {plugin?.description && <div>{plugin?.description}</div>}
          {!config.featureToggles.pluginsDetailsRightPanel && !!plugin?.details?.links?.length && (
            <span>
              {plugin.details.links.map((link, index) => (
                <Fragment key={index}>
                  {index > 0 && ' | '}
                  <a href={link.url} className="external-link">
                    {link.name}
                  </a>
                </Fragment>
              ))}
            </span>
          )}
          {hasInstallControlWarning(plugin, isRemotePluginsAvailable, latestCompatibleVersion) && (
            <InstallControlsWarning
              plugin={plugin}
              pluginStatus={pluginStatus}
              latestCompatibleVersion={latestCompatibleVersion}
            />
          )}
        </div>
        {pluginSubtitleExtensions.map((extension) => {
          return <Fragment key={extension.name}>{extension({ plugin })}</Fragment>;
        })}
      </Stack>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    subtitle: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
  };
};
