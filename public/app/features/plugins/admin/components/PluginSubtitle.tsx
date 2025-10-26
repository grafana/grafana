import { css } from '@emotion/css';
import { Fragment } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Stack, useStyles2 } from '@grafana/ui';

import { InstallControlsWarning } from '../components/InstallControls/InstallControlsWarning';
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
  return { subtitle: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1) }) };
};
