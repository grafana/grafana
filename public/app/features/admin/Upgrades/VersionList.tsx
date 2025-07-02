import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, LinkButton, Stack, useStyles2 } from '@grafana/ui';

interface Version {
  version: string;
  releaseDate: string;
  notes?: string;
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
      <img src="/public/img/grafana_icon.svg" alt="Grafana Logo" style={{ height: 32, width: 32 }} />
      <span>Grafana Version: {installedVersion}</span>
      <Badge text="Installed" color="green" icon="check" />
    </h1>
    {versions.length === 0 ? (<p>No recommended upgrades found.</p>) : (
    <>
    <h2>Recommended Upgrades</h2>
    <p>The following upgrades are recommended for your Grafana instance to ensure you are running the latest supported version of Grafana.</p>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Version</th>
          <th></th>
          <th>Release Date</th>
          <th>Upgrade Type</th>
          <th>Support Status</th>
          <th>More Info</th>
        </tr>
      </thead>
      <tbody>
        <tr></tr>
        {versions.map((v) => {
          return (
            <tr key={v.version}>
              <td>{v.version}</td>
              <td>
                  <LinkButton
                    fill="solid"
                    variant="secondary"
                    icon="download-alt"
                    size="sm"
                    className={styles.badge}
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
                <a
                  href={`https://github.com/grafana/grafana/releases/tag/v${v.version}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <LinkButton
                    type="button"
                    variant="secondary"
                    icon="info-circle"
                    href={`https://github.com/grafana/grafana/releases/tag/v${v.version}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Release Notes
                  </LinkButton>
                </a>
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
  container: css({
    padding: theme.spacing(2, 4, 3),
  }),
  spinner: css({
    marginLeft: theme.spacing(1),
  }),
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
  badge: css({
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '50%',
  }),
});
