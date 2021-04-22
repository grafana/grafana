import React, { useState, useEffect, useCallback } from 'react';
import { cx, css } from '@emotion/css';

import { AppRootProps, GrafanaTheme } from '@grafana/data';
import { useTheme, TabsBar, TabContent, Tab, Icon, stylesFactory } from '@grafana/ui';

import { VersionList } from '../components/VersionList';
import { InstallControls } from '../components/InstallControls';
import { PLUGIN_ROOT, GRAFANA_API_ROOT } from '../constants';
import { MarketplaceAppSettings, PluginDetails as PluginDeets } from '../types';
import API from '../api';

export const PluginDetails = ({ query, meta }: AppRootProps) => {
  const { slug } = query;
  const { pluginDir } = meta.jsonData as MarketplaceAppSettings;

  const [state, setState] = useState<PluginDeets>();
  const [loading, setLoading] = useState(false);

  const [tabs, setTabs] = useState([
    { label: 'Overview', active: true },
    { label: 'Version history', active: false },
  ]);

  const theme = useTheme();
  const styles = getStyles(theme);

  const onRefresh = useCallback(() => {
    (async () => {
      const api = new API(pluginDir);
      setState(await api.getPlugin(slug));
      setLoading(false);
    })();
  }, [slug, pluginDir]);

  useEffect(() => {
    setLoading(true);
    onRefresh();
  }, [onRefresh]);

  const description = state?.remote?.description;
  const readme = state?.remote?.readme;
  const version = state?.local?.info?.version || state?.remote?.version;
  const links = (state?.local?.info?.links || state?.remote?.json?.info?.links) ?? [];
  const downloads = state?.remote?.downloads;

  const skeletonStyles = {
    root: css`
      width: 100%;
      display: flex;
    `,

    logo: css`
      background-image: radial-gradient(circle 64px at 64px 64px, ${theme.colors.bg3} 99%, transparent 0);
      width: 128px;
      height: 128px;
      margin-right: ${theme.spacing.lg};
    `,
    title: css`
      height: 30px;
      width: 256px;
      background-color: ${theme.colors.bg3};
      border-radius: ${theme.border.radius.md};
      margin-bottom: ${theme.spacing.md};
    `,
    org: css`
      height: 24px;
      width: 64px;
      background-color: ${theme.colors.bg3};
      border-radius: ${theme.border.radius.md};
    `,

    link: css`
      height: 24px;
      width: 72px;
      background-color: ${theme.colors.bg3};
      border-radius: ${theme.border.radius.md};
    `,
    linkGroup: css`
      display: flex;
      margin-bottom: 24px;
      & > * {
        margin-right: ${theme.spacing.sm};
      }
      & > *:last-child {
        margin-right: 0;
      }
    `,
    description: css`
      height: 18px;
      width: 512px;
      background-color: ${theme.colors.bg3};
      border-radius: ${theme.border.radius.md};
      margin-bottom: 8px;
    `,
    content: css``,
  };

  return (
    <>
      <div
        className={css`
          display: flex;
          margin-bottom: 64px;
          min-height: 160px;
        `}
      >
        {loading ? (
          <div className={skeletonStyles.root}>
            <div className={skeletonStyles.logo}></div>
            <div className={skeletonStyles.content}>
              <div className={skeletonStyles.title}></div>
              <div className={skeletonStyles.linkGroup}>
                <div className={skeletonStyles.org}></div>
                <div className={skeletonStyles.link}></div>
              </div>
              <div className={skeletonStyles.description}></div>
            </div>
          </div>
        ) : (
          <>
            <img
              src={`${GRAFANA_API_ROOT}/plugins/${slug}/versions/${state?.remote?.version}/logos/small`}
              className={css`
                object-fit: cover;
                width: 100%;
                height: 128px;
                max-width: 128px;
              `}
            />
            <div
              className={css`
                margin-left: ${theme.spacing.lg};
              `}
            >
              <h1>{state?.remote?.name}</h1>
              <div
                className={css`
                  display: flex;
                  align-items: center;
                  margin-top: ${theme.spacing.sm};
                  margin-bottom: ${theme.spacing.lg};
                  & > * {
                    &::after {
                      content: '|';
                      padding: 0 ${theme.spacing.md};
                    }
                  }
                  & > *:last-child {
                    &::after {
                      content: '';
                      padding-right: 0;
                    }
                  }
                  font-size: ${theme.typography.size.lg};
                `}
              >
                <a
                  className={css`
                    font-size: ${theme.typography.size.lg};
                  `}
                  href={`${PLUGIN_ROOT}?tab=org&orgSlug=${state?.remote?.orgSlug}`}
                >
                  {state?.remote?.orgName}
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
              {state?.remote && (
                <InstallControls
                  localPlugin={state?.local}
                  remotePlugin={state?.remote}
                  slug={slug}
                  pluginDir={pluginDir}
                  onRefresh={onRefresh}
                />
              )}
            </div>
          </>
        )}
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
        {tabs.find((_) => _.label === 'Overview')?.active &&
          (loading ? (
            <div className={skeletonStyles.root}>
              <div
                className={cx(
                  skeletonStyles.content,
                  css`
                    margin-top: 24px;
                  `
                )}
              >
                <div className={skeletonStyles.title}></div>
                <div className={skeletonStyles.description}></div>
                <div className={skeletonStyles.description}></div>
              </div>
            </div>
          ) : (
            <div className={styles.readme} dangerouslySetInnerHTML={{ __html: readme ?? '' }}></div>
          ))}
        {tabs.find((_) => _.label === 'Version history')?.active && (
          <VersionList versions={state?.remoteVersions ?? []} />
        )}
      </TabContent>
    </>
  );
};

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    message: css`
      color: ${theme.colors.textSemiWeak};
    `,
    horizontalGroup: css`
      display: flex;
      align-items: center;

      & > * {
        margin-right: ${theme.spacing.sm};
      }

      & > *:last-child {
        margin-right: 0;
      }
    `,
    readme: css`
      margin: ${theme.spacing.lg} 0;

      & img {
        max-width: 100%;
      }

      h1,
      h2,
      h3 {
        margin-top: ${theme.spacing.lg};
        margin-bottom: ${theme.spacing.md};
      }

      li {
        margin-left: ${theme.spacing.md};
        & > p {
          margin: ${theme.spacing.sm} 0;
        }
      }
    `,
  };
});
