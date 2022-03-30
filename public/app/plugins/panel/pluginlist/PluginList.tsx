import React from 'react';
import { useAsync } from 'react-use';
import { css, cx } from '@emotion/css';
import { GrafanaTheme, PanelProps, PluginMeta, PluginType } from '@grafana/data';
import { CustomScrollbar, ModalsController, stylesFactory, Tooltip, useStyles } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { UpdatePluginModal } from './components/UpdatePluginModal';

export function PluginList(props: PanelProps) {
  const pluginState = useAsync(async () => {
    const plugins: PluginMeta[] = await getBackendSrv().get('api/plugins', { embedded: 0, core: 0 });
    return [
      { header: 'Installed Apps', list: plugins.filter((p) => p.type === PluginType.app), type: PluginType.app },
      { header: 'Installed Panels', list: plugins.filter((p) => p.type === PluginType.panel), type: PluginType.panel },
      {
        header: 'Installed Datasources',
        list: plugins.filter((p) => p.type === PluginType.datasource),
        type: PluginType.datasource,
      },
    ];
  }, []);

  const styles = useStyles(getStyles);
  const isAdmin = contextSrv.user.isGrafanaAdmin;

  if (pluginState.loading || pluginState.value === undefined) {
    return null;
  }

  return (
    <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
      <div className={styles.pluginList}>
        {pluginState.value.map((category) => (
          <div className={styles.section} key={`category-${category.type}`}>
            <h6 className={styles.sectionHeader}>{category.header}</h6>
            {category.list.map((plugin) => (
              <a className={styles.item} href={plugin.defaultNavUrl} key={`plugin-${plugin.id}`}>
                <img src={plugin.info.logos.small} className={styles.image} width="17" height="17" alt="" />
                <span className={styles.title}>{plugin.name}</span>
                <span className={styles.version}>v{plugin.info.version}</span>
                {isAdmin &&
                  (plugin.hasUpdate ? (
                    <ModalsController>
                      {({ showModal, hideModal }) => (
                        <Tooltip content={`New version: ${plugin.latestVersion}`} placement="top">
                          <span
                            className={cx(styles.message, styles.messageUpdate)}
                            onClick={(e) => {
                              e.preventDefault();

                              showModal(UpdatePluginModal, {
                                pluginID: plugin.id,
                                pluginName: plugin.name,
                                onDismiss: hideModal,
                                isOpen: true,
                              });
                            }}
                          >
                            Update available!
                          </span>
                        </Tooltip>
                      )}
                    </ModalsController>
                  ) : plugin.enabled ? (
                    <span className={cx(styles.message, styles.messageNoUpdate)}>Up to date</span>
                  ) : (
                    <span className={cx(styles.message, styles.messageEnable)}>Enable now</span>
                  ))}
              </a>
            ))}

            {category.list.length === 0 && (
              <a className={styles.item} href="https://grafana.com/plugins">
                <span className={styles.noneInstalled}>
                  None installed. <em className={styles.emphasis}>Browse Grafana.com</em>
                </span>
              </a>
            )}
          </div>
        ))}
      </div>
    </CustomScrollbar>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  pluginList: css`
    display: flex;
    flex-direction: column;
  `,
  section: css`
    display: flex;
    flex-direction: column;
    &:not(:last-of-type) {
      margin-bottom: 16px;
    }
  `,
  sectionHeader: css`
    color: ${theme.colors.textWeak};
    margin-bottom: ${theme.spacing.d};
  `,
  image: css`
    width: 17px;
    margin-right: ${theme.spacing.xxs};
  `,
  title: css`
    margin-right: calc(${theme.spacing.d} / 3);
  `,
  version: css`
    font-size: ${theme.typography.size.sm};
    color: ${theme.colors.textWeak};
  `,
  item: css`
    display: flex;
    justify-content: flex-start;
    align-items: center;
    cursor: pointer;
    margin: ${theme.spacing.xxs};
    padding: ${theme.spacing.sm};
    background: ${theme.colors.dashboardBg};
    border-radius: ${theme.border.radius.md};
  `,
  message: css`
    margin-left: auto;
    font-size: ${theme.typography.size.sm};
  `,
  messageEnable: css`
    color: ${theme.colors.linkExternal};
    &:hover {
      border-bottom: ${theme.border.width.sm} solid ${theme.colors.linkExternal};
    }
  `,
  messageUpdate: css`
    &:hover {
      border-bottom: ${theme.border.width.sm} solid ${theme.colors.text};
    }
  `,
  messageNoUpdate: css`
    color: ${theme.colors.textWeak};
  `,
  noneInstalled: css`
    color: ${theme.colors.textWeak};
    font-size: ${theme.typography.size.sm};
  `,
  emphasis: css`
    font-weight: ${theme.typography.weight.semibold};
    font-style: normal;
    color: ${theme.colors.textWeak};
  `,
}));
