import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, LinkButton, Stack, useStyles2 } from '@grafana/ui';
import grafanaLogo from 'img/grafana_icon.svg';

interface Version {
  version: string;
  releaseDate: string;
  state: string;
  isOutOfSupport: boolean;
  type: string;
  name: string;
}

interface Props {
  versions: Version[];
  installedVersion?: string;
  dismissUpgradeFn: (upgradeID: string) => Promise<void>;
}

export function VersionList({ versions, installedVersion, dismissUpgradeFn }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="column" gap={2}>
      <br></br>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src={grafanaLogo} alt="Grafana Logo" style={{ height: 32, width: 32 }} />
        <Trans i18nKey="admin.upgrades.grafana-version">Grafana Version: {installedVersion}</Trans>
        <Badge text={t('admin.upgrades.installed-text', 'Installed')} color="green" icon="check" />
      </h1>
      {versions.length === 0 ? (
        <p>
          <Trans i18nKey="admin.upgrades.noUpgrades">No recommended upgrades found.</Trans>
        </p>
      ) : (
        <>
          <h2>
            <Trans i18nKey="admin.upgrades.recommendedUpgrades">Recommended Upgrades</Trans>
          </h2>
          <p>
            <Trans i18nKey="admin.upgrades.recommendedUpgradesDescription">
              The following upgrades are recommended for your Grafana instance to ensure you are running the latest
              supported version of Grafana.
            </Trans>
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <Trans i18nKey="admin.upgrades.version">Version</Trans>
                </th>
                <th></th>
                <th>
                  <Trans i18nKey="admin.upgrades.releaseDate">Release Date</Trans>
                </th>
                <th>
                  <Trans i18nKey="admin.upgrades.upgradeType">Upgrade Type</Trans>
                </th>
                <th>
                  <Trans i18nKey="admin.upgrades.supportStatus">Support Status</Trans>
                </th>
                <th>
                  <Trans i18nKey="admin.upgrades.changelog">Changelog</Trans>
                </th>
                <th>
                  <Trans i18nKey="admin.upgrades.upgradeGuide">Upgrade Guide</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => {
                return (
                  <tr key={v.version}>
                    <td>{v.version}</td>
                    <td>
                      <LinkButton
                        fill="solid"
                        variant="primary"
                        icon="download-alt"
                        size="sm"
                        href={`https://grafana.com/grafana/download/${v.version}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        tooltip={t('admin.upgrades.downloadPageTooltip', 'Go to download page')}
                      >
                        <Trans i18nKey="admin.upgrades.downloadPage">Download Page</Trans>
                      </LinkButton>{' '}
                      &nbsp;
                      <LinkButton
                        fill="solid"
                        variant="destructive"
                        icon="times"
                        size="sm"
                        rel="noopener noreferrer"
                        tooltip={t('admin.upgrades.dismissTooltip', 'Dismiss')}
                        onClick={() => dismissUpgradeFn(v.name)}
                      >
                        <Trans i18nKey="admin.upgrades.dismiss">Dismiss</Trans>
                      </LinkButton>
                    </td>
                    <td>{v.releaseDate}</td>
                    <td>{v.type.toUpperCase()}</td>
                    <td>{v.isOutOfSupport ? t('admin.upgrades.outOfSupport', 'Out of Support') : t('admin.upgrades.inSupport', 'In Support')}</td>
                    <td>
                      <LinkButton
                        type="button"
                        variant="secondary"
                        icon="info-circle"
                        size="sm"
                        href={`https://github.com/grafana/grafana/releases/tag/v${v.version}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        tooltip={t('admin.upgrades.releaseNotesTooltip', 'Release Notes')}
                      >
                        <Trans i18nKey="admin.upgrades.releaseNotes">Release Notes</Trans>
                      </LinkButton>
                    </td>
                    <td>
                      <LinkButton
                        type="button"
                        variant="secondary"
                        icon="external-link-alt"
                        size="sm"
                        href={`https://grafana.com/docs/grafana/latest/upgrade-guide/upgrade-v${v.version.split('.')?.slice(0, 2)?.join('.')}`} // Upgrade guides only go as deep as the minor version
                        target="_blank"
                        rel="noopener noreferrer"
                        tooltip={t('admin.upgrades.upgradeGuideTooltip', 'Upgrade Guide')}
                      >
                        <Trans i18nKey="admin.upgrades.upgradeGuide">Upgrade Guide</Trans>
                      </LinkButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    marginTop: theme.spacing(2),
    width: '100%',
    'td, th': {
      padding: `${theme.spacing()} 0`,
    },
    th: {
      fontSize: theme.typography.h5.fontSize,
    },
    td: {
      wordBreak: 'break-word',
    },
    'tbody tr:nth-child(odd)': {
      background: theme.colors.emphasize(theme.colors.background.primary, 0.02),
    },
  }),
});
