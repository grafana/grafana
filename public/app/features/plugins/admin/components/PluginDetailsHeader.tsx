import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon, HorizontalGroup } from '@grafana/ui';

import { getLatestCompatibleVersion } from '../helpers';
import { CatalogPlugin } from '../types';

import { PluginDisabledBadge } from './Badges';
import { GetStartedWithPlugin } from './GetStartedWithPlugin';
import { InstallControls } from './InstallControls';
import { PluginDetailsHeaderDependencies } from './PluginDetailsHeaderDependencies';
import { PluginDetailsHeaderSignature } from './PluginDetailsHeaderSignature';

type Props = {
  plugin: CatalogPlugin;
};

export function PluginDetailsHeader({ plugin }: Props): React.ReactElement {
  const styles = useStyles2(getStyles);
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin.details?.versions);
  const version = plugin.installedVersion || latestCompatibleVersion?.version;

  return (
    <div className={styles.headerContainer}>
      {plugin.description && <div className={styles.description}>{plugin.description}</div>}

      <div className={styles.headerInformationRow}>
        {/* Version */}
        {Boolean(version) && <span>Version: {version}</span>}

        {/* Org name */}
        <span>From: {plugin.orgName}</span>

        {/* Links */}
        {plugin.details?.links.map((link: any) => (
          <a key={link.name} href={link.url} className="external-link">
            {link.name}
          </a>
        ))}

        {/* Downloads */}
        {plugin.downloads > 0 && (
          <span>
            <Icon name="cloud-download" />
            {` ${new Intl.NumberFormat().format(plugin.downloads)}`}{' '}
          </span>
        )}

        {/* Signature information */}
        <PluginDetailsHeaderSignature plugin={plugin} />

        {plugin.isDisabled && <PluginDisabledBadge error={plugin.error!} />}

        <PluginDetailsHeaderDependencies plugin={plugin} latestCompatibleVersion={latestCompatibleVersion} />
      </div>

      <HorizontalGroup height="auto">
        <InstallControls plugin={plugin} latestCompatibleVersion={latestCompatibleVersion} />
        <GetStartedWithPlugin plugin={plugin} />
      </HorizontalGroup>
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    headerContainer: css`
      display: flex;
      flex-direction: column;
      margin-bottom: ${theme.spacing(1)};
    `,
    description: css`
      margin: ${theme.spacing(-1, 0, 1)};
    `,
    breadcrumb: css`
      font-size: ${theme.typography.h2.fontSize};
      li {
        display: inline;
        list-style: none;
        &::after {
          content: '/';
          padding: 0 0.25ch;
        }
        &:last-child::after {
          content: '';
        }
      }
    `,
    headerInformationRow: css`
      display: flex;
      align-items: center;
      margin-bottom: ${theme.spacing(1)};
      flex-flow: wrap;

      & > * {
        &::after {
          content: '|';
          padding: 0 ${theme.spacing()};
        }
        &:last-child::after {
          content: '';
          padding-right: 0;
        }
      }

      a {
        &:hover {
          text-decoration: underline;
        }
      }
    `,
    headerOrgName: css`
      font-size: ${theme.typography.h4.fontSize};
    `,
    signature: css`
      margin: ${theme.spacing(3)};
      margin-bottom: 0;
    `,
    textUnderline: css`
      text-decoration: underline;
    `,
  };
};
