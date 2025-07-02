import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, LinkButton, Stack, useStyles2 } from '@grafana/ui';

import GrafanaLogo from '/public/img/grafana_icon.svg';

interface Version {
  version: string;
  releaseDate: string;
  state: string;
  isOutOfSupport: boolean;
  type: string;
}

interface Props {
  versions: Version[];
  installedVersion?: string;
}

export function VersionList({ versions, installedVersion }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="column" gap={2}>
      <br></br>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src={GrafanaLogo} alt="Grafana Logo" style={{ height: 32, width: 32 }} />
        <span>Grafana Version: {installedVersion}</span>
        <Badge text="Installed" color="green" icon="check" />
      </h1>
      {versions.length === 0 ? (
        <p>No recommended upgrades found.</p>
      ) : (
        <>
          <h2>Recommended Upgrades</h2>
          <p>
            The following upgrades are recommended for your Grafana instance to ensure you are running the latest
            supported version of Grafana.
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Version</th>
                <th></th>
                <th>Release Date</th>
                <th>Upgrade Type</th>
                <th>Support Status</th>
                <th>Changelog</th>
                <th>Upgrade Guide</th>
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
                        tooltip="Install"
                      >
                        Install
                      </LinkButton>
                    </td>
                    <td>{v.releaseDate}</td>
                    <td>{v.type.toUpperCase()}</td>
                    <td>{v.isOutOfSupport ? 'Out of Support' : 'In Support'}</td>
                    <td>
                      <LinkButton
                        type="button"
                        variant="secondary"
                        icon="info-circle"
                        size="sm"
                        href={`https://github.com/grafana/grafana/releases/tag/v${v.version}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Release Notes
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
                      >
                        Upgrade Guide
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
