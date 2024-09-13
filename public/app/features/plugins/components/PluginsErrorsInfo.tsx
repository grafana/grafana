import { css } from '@emotion/css';

import { GrafanaTheme2, PluginErrorCode, PluginSignatureStatus, PluginType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, Icon, List, PluginSignatureBadge, Stack, useStyles2 } from '@grafana/ui';

import { useGetErrors, useFetchStatus } from '../admin/state/hooks';

type PluginsErrorInfoProps = {
  filterByPluginType?: PluginType;
};

export function PluginsErrorsInfo({ filterByPluginType }: PluginsErrorInfoProps) {
  let errors = useGetErrors(filterByPluginType);
  const { isLoading } = useFetchStatus();
  const styles = useStyles2(getStyles);

  if (isLoading || errors.length === 0) {
    return null;
  }

  return (
    <Alert
      title="Unsigned plugins were found during plugin initialization. Grafana Labs cannot guarantee the integrity of these plugins. We recommend only using signed plugins."
      data-testid={selectors.pages.PluginsList.signatureErrorNotice}
      severity="warning"
    >
      <p>The following plugins are disabled and not shown in the list below:</p>
      <List
        items={errors}
        className={styles.list}
        renderItem={(error) => (
          <div className={styles.wrapper}>
            <Stack justifyContent="flex-start" alignItems="center">
              <strong>{error.pluginId}</strong>
              <PluginSignatureBadge
                status={mapPluginErrorCodeToSignatureStatus(error.errorCode)}
                className={styles.badge}
              />
            </Stack>
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
