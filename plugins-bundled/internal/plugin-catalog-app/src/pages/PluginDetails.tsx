import React, { useState } from 'react';
import { css } from '@emotion/css';

import { AppRootProps, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, TabsBar, TabContent, Tab, Icon } from '@grafana/ui';

import { VersionList } from '../components/VersionList';
import { InstallControls } from '../components/InstallControls';
import { PLUGIN_ROOT, GRAFANA_API_ROOT } from '../constants';
import { usePlugin } from '../hooks/usePlugins';
import { Page } from 'components/Page';
import { Loader } from 'components/Loader';

export const PluginDetails = ({ query }: AppRootProps) => {
  const { slug } = query;
  const [tabs, setTabs] = useState([
    { label: 'Overview', active: true },
    { label: 'Version history', active: false },
  ]);
  const { isLoading, local, remote, remoteVersions } = usePlugin(slug);
  const styles = useStyles2(getStyles);

  const description = remote?.description;
  const readme = remote?.readme;
  const version = local?.info?.version || remote?.version;
  const links = (local?.info?.links || remote?.json?.info?.links) ?? [];
  const downloads = remote?.downloads;

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Page>
      <div className={styles.headerContainer}>
        <img
          src={`${GRAFANA_API_ROOT}/plugins/${slug}/versions/${remote?.version}/logos/small`}
          className={css`
            object-fit: cover;
            width: 100%;
            height: 68px;
            max-width: 68px;
          `}
        />
        <div className={styles.headerWrapper}>
          <h1>{remote?.name}</h1>
          <div className={styles.headerLinks}>
            <a className={styles.headerOrgName} href={`${PLUGIN_ROOT}?tab=org&orgSlug=${remote?.orgSlug}`}>
              {remote?.orgName}
            </a>
            {links.map((link: any) => (
              <a key={link.name} href={link.url}>
                {link.name}
              </a>
            ))}
            {downloads && (
              <span>
                <Icon name="cloud-download" />
                {` ${new Intl.NumberFormat().format(downloads)}`}{' '}
              </span>
            )}
            {version && <span>{version}</span>}
          </div>
          <p>{description}</p>
          {remote && <InstallControls localPlugin={local} remotePlugin={remote} slug={slug} />}
        </div>
      </div>
      <TabsBar>
        {tabs.map((tab, key) => (
          <Tab
            key={key}
            label={tab.label}
            active={tab.active}
            onChangeTab={() => {
              setTabs(tabs.map((tab, index) => ({ ...tab, active: index === key })));
            }}
          />
        ))}
      </TabsBar>
      <TabContent>
        {tabs.find((_) => _.label === 'Overview')?.active && (
          <div className={styles.readme} dangerouslySetInnerHTML={{ __html: readme ?? '' }} />
        )}
        {tabs.find((_) => _.label === 'Version history')?.active && <VersionList versions={remoteVersions ?? []} />}
      </TabContent>
    </Page>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    headerContainer: css`
      display: flex;
      margin-bottom: 24px;
      margin-top: 24px;
      min-height: 120px;
    `,
    headerWrapper: css`
      margin-left: ${theme.spacing(3)};
    `,
    headerLinks: css`
      display: flex;
      align-items: center;
      margin-top: ${theme.spacing()};
      margin-bottom: ${theme.spacing(3)};

      & > * {
        &::after {
          content: '|';
          padding: 0 ${theme.spacing()};
        }
      }
      & > *:last-child {
        &::after {
          content: '';
          padding-right: 0;
        }
      }
      font-size: ${theme.typography.h4.fontSize};
    `,
    headerOrgName: css`
      font-size: ${theme.typography.h4.fontSize};
    `,
    message: css`
      color: ${theme.colors.text.secondary};
    `,
    readme: css`
      padding: ${theme.spacing(3, 4)};

      & img {
        max-width: 100%;
      }

      h1,
      h2,
      h3 {
        margin-top: ${theme.spacing(3)};
        margin-bottom: ${theme.spacing(2)};
      }

      *:first-child {
        margin-top: 0;
      }

      li {
        margin-left: ${theme.spacing(2)};
        & > p {
          margin: ${theme.spacing()} 0;
        }
      }
    `,
  };
};
