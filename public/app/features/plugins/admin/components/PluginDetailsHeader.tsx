import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon, HorizontalGroup } from '@grafana/ui';

import { InstallControls } from './InstallControls';
import { PluginDetailsHeaderSignature } from './PluginDetailsHeaderSignature';
import { PluginDetailsHeaderDependencies } from './PluginDetailsHeaderDependencies';
import { PluginLogo } from './PluginLogo';
import { CatalogPlugin } from '../types';
import { PluginDisabledBadge } from './Badges';
import { GetStartedWithPlugin } from './GetStartedWithPlugin';
import { getLatestCompatibleVersion } from '../helpers';

type Props = {
  currentUrl: string;
  parentUrl: string;
  plugin: CatalogPlugin;
};

export function PluginDetailsHeader({ plugin, currentUrl, parentUrl }: Props): React.ReactElement {
  const styles = useStyles2(getStyles);
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin.details?.versions);
  const version = plugin.installedVersion || latestCompatibleVersion?.version;

  return (
    <div className={styles.headerContainer}>
      <PluginLogo
        alt={`${plugin.name} logo`}
        src={plugin.info.logos.small}
        className={css`
          object-fit: contain;
          width: 100%;
          height: 68px;
          max-width: 68px;
        `}
      />

      <div className={styles.headerWrapper}>
        {/* Title & navigation */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <ol>
            <li>
              <a className={styles.textUnderline} href={parentUrl}>
                Plugins
              </a>
            </li>
            <li>
              <a href={currentUrl} aria-current="page">
                {plugin.name}
              </a>
            </li>
          </ol>
        </nav>

        <div className={styles.headerInformationRow}>
          {/* Org name */}
          <span>{plugin.orgName}</span>

          {/* Links */}
          {plugin.details?.links.map((link: any) => (
            <a key={link.name} href={link.url}>
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

          {/* Version */}
          {Boolean(version) && <span>{version}</span>}

          {/* Signature information */}
          <PluginDetailsHeaderSignature plugin={plugin} />

          {plugin.isDisabled && <PluginDisabledBadge error={plugin.error!} />}
        </div>

        <PluginDetailsHeaderDependencies
          plugin={plugin}
          latestCompatibleVersion={latestCompatibleVersion}
          className={cx(styles.headerInformationRow, styles.headerInformationRowSecondary)}
        />

        <p>{plugin.description}</p>

        <HorizontalGroup height="auto">
          <InstallControls plugin={plugin} latestCompatibleVersion={latestCompatibleVersion} />
          <GetStartedWithPlugin plugin={plugin} />
        </HorizontalGroup>
      </div>
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    headerContainer: css`
      display: flex;
      margin-bottom: ${theme.spacing(3)};
      margin-top: ${theme.spacing(3)};
      min-height: 120px;
    `,
    headerWrapper: css`
      margin-left: ${theme.spacing(3)};
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
      margin-top: ${theme.spacing()};
      margin-bottom: ${theme.spacing()};
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
      font-size: ${theme.typography.h4.fontSize};
    `,
    headerInformationRowSecondary: css`
      font-size: ${theme.typography.body.fontSize};
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
