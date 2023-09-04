import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PluginErrorCode, PluginSignatureStatus, PluginType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, HorizontalGroup, Icon, List, PluginSignatureBadge, useStyles2 } from '@grafana/ui';

import { useGetErrors, useFetchStatus } from '../admin/state/hooks';

type PluginsErrorInfoProps = {
  filterByPluginType?: PluginType;
};

export function PluginsErrorsInfo({ filterByPluginType }: PluginsErrorInfoProps) {
  let errors = useGetErrors();
  const { isLoading } = useFetchStatus();
  const styles = useStyles2(getStyles);
  if (filterByPluginType) {
    errors = errors.filter((pluginError) => {
      const pluginIdParts = pluginError.pluginId.split('-');
      const pluginType = pluginIdParts[pluginIdParts.length - 1];

      return pluginType === filterByPluginType;
    });
  }

  if (isLoading || errors.length === 0) {
    return null;
  }

  return (
    <Alert
      title="Read more about plugin signing"
      aria-label={selectors.pages.PluginsList.signatureErrorNotice}
      severity="warning"
    >
      <p>
        Unsigned plugins were found during plugin initialization. Grafana Labs cannot guarantee the integrity of these
        plugins. We recommend only using signed plugins.
      </p>
      The following plugins are disabled and not shown in the list below:
      <List
        items={errors}
        className={styles.list}
        renderItem={(error) => (
          <div className={styles.wrapper}>
            <HorizontalGroup spacing="sm" justify="flex-start" align="center">
              <strong>{error.pluginId}</strong>
              <PluginSignatureBadge
                status={mapPluginErrorCodeToSignatureStatus(error.errorCode)}
                className={styles.badge}
              />
            </HorizontalGroup>
          </div>
        )}
      />
      <a
        href="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/"
        className={styles.docsLink}
        target="_blank"
        rel="noreferrer"
      >
        <Icon name="book" /> Read more about plugin signing
      </a>
    </Alert>
  );
}

function mapPluginErrorCodeToSignatureStatus(code: PluginErrorCode) {
  switch (code) {
    case PluginErrorCode.invalidSignature:
      return PluginSignatureStatus.invalid;
    case PluginErrorCode.missingSignature:
      return PluginSignatureStatus.missing;
    case PluginErrorCode.modifiedSignature:
      return PluginSignatureStatus.modified;
    default:
      return PluginSignatureStatus.missing;
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      listStyleType: 'circle',
    }),
    wrapper: css({
      marginTop: theme.spacing(1),
    }),
    badge: css({
      marginTop: 0,
    }),
    docsLink: css({
      display: 'inline-block',
      color: theme.colors.text.link,
      marginTop: theme.spacing(2),
    }),
  };
}
