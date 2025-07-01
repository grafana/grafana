import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';

interface Version {
  version: string;
  releaseDate: string;
  notes?: string;
}

interface Props {
  versions: Version[];
  installedVersion?: string;
}

export function VersionList({ versions, installedVersion }: Props) {
  const styles = useStyles2(getStyles);

  if (!versions || versions.length === 0) {
    return <p>No version history was found.</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Version</th>
          <th>Release Date</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {versions.map((v) => {
          const isInstalled = v.version === installedVersion;
          return (
            <tr key={v.version}>
              <td>{v.version}{isInstalled && ' (installed)'}</td>
              <td>{v.releaseDate}</td>
              <td>{v.notes || '-'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(2, 4, 3),
  }),
  currentVersion: css({
    fontWeight: theme.typography.fontWeightBold,
  }),
  spinner: css({
    marginLeft: theme.spacing(1),
  }),
  table: css({
    tableLayout: 'fixed',
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

