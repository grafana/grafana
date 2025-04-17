import { css } from '@emotion/css';

import { GrafanaTheme2, PluginErrorCode, PluginSignatureStatus, PluginType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, List, PluginSignatureBadge, Stack, TextLink, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { t } from '../../../core/internationalization';
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
      title={t(
        'plugins.plugins-errors-info.title-unsigned-plugins',
        'Unsigned plugins were found during plugin initialization. Grafana Labs cannot guarantee the integrity of these plugins. We recommend only using signed plugins.'
      )}
      data-testid={selectors.pages.PluginsList.signatureErrorNotice}
      severity="warning"
    >
      <p>
        <Trans i18nKey="plugins.plugins-errors-info.disabled-list">
          The following plugins are disabled and not shown in the list below:
        </Trans>
      </p>
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
      <TextLink
        href="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/"
        external
        className={styles.docsLink}
      >
        <Trans i18nKey="plugins.plugins-errors-info.read-more-about-plugin-signing">
          Read more about plugin signing
        </Trans>
      </TextLink>
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
      marginTop: theme.spacing(2),
    }),
  };
}
