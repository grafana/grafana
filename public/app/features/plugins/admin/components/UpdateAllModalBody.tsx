import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Checkbox, EmptyState, Icon, Spinner, Tooltip, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { CatalogPlugin } from '../types';

type UpdateError = {
  id: string;
  message: string;
};

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    marginTop: theme.spacing(2),
    width: '100%',
    borderCollapse: 'collapse',
  }),
  tableRow: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    td: {
      paddingRight: theme.spacing(1),
    },
  }),
  icon: css({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }),
  header: css({
    textAlign: 'left',
    padding: theme.spacing(1),
    borderBottom: `2px solid ${theme.colors.border.strong}`,
    th: {
      paddingRight: theme.spacing(1),
    },
  }),
  data: css({
    padding: '10px',
  }),
  footer: css({
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing(3),
  }),
  noPluginsMessage: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  }),
  tableContainer: css({
    overflowY: 'auto',
    overflowX: 'hidden',
    maxHeight: theme.spacing(41),
    marginBottom: theme.spacing(2),
  }),
  errorIcon: css({
    color: theme.colors.error.main,
  }),
  successIcon: css({
    color: theme.colors.success.main,
  }),
  pluginsInstalled: css({
    svg: {
      marginRight: theme.spacing(1),
    },
  }),
});

const StatusIcon = ({
  id,
  inProgress,
  isSelected,
  isInstalled,
  errorMap,
}: {
  id: string;
  inProgress: boolean;
  isSelected: boolean;
  isInstalled: boolean;
  errorMap: Map<string, UpdateError>;
}) => {
  const styles = useStyles2(getStyles);

  if (errorMap && errorMap.has(id)) {
    return (
      <Tooltip
        content={`${t('plugins.catalog.update-all.error', 'Error updating plugin:')} ${errorMap.get(id)?.message}`}
      >
        <Icon className={styles.errorIcon} size="xl" name="exclamation-triangle" />
      </Tooltip>
    );
  }
  if (isInstalled) {
    return <Icon className={styles.successIcon} size="xl" name="check" />;
  }
  if (inProgress && isSelected) {
    return <Spinner />;
  }
  return '';
};

type Props = {
  plugins: CatalogPlugin[];
  pluginsNotInstalled: Set<string>;
  inProgress: boolean;
  selectedPlugins?: Set<string>;
  onCheckboxChange: (id: string) => void;
  errorMap: Map<string, UpdateError>;
};

export const UpdateModalBody = ({
  plugins,
  pluginsNotInstalled,
  inProgress,
  selectedPlugins,
  onCheckboxChange,
  errorMap,
}: Props) => {
  const styles = useStyles2(getStyles);

  const numberInstalled = plugins.length - pluginsNotInstalled.size;
  const installationFinished = plugins.length !== pluginsNotInstalled.size && !inProgress;

  return (
    <div>
      {plugins.length === 0 ? (
        <EmptyState
          variant="completed"
          message={t('plugins.catalog.update-all.all-plugins-updated', 'All plugins updated!')}
        />
      ) : (
        <>
          <div>
            <Trans i18nKey="plugins.catalog.update-all.header">The following plugins have update available</Trans>
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead className={styles.header}>
                <tr>
                  <th>
                    <Trans i18nKey="plugins.catalog.update-all.update-header">Update</Trans>
                  </th>
                  <th>
                    <Trans i18nKey="plugins.catalog.update-all.name-header">Name</Trans>
                  </th>
                  <th>
                    <Trans i18nKey="plugins.catalog.update-all.installed-header">Installed</Trans>
                  </th>
                  <th>
                    <Trans i18nKey="plugins.catalog.update-all.available-header">Available</Trans>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {plugins.map(({ id, name, installedVersion, latestVersion }: CatalogPlugin) => (
                  <tr key={id} className={styles.tableRow}>
                    <td>
                      <Checkbox
                        onChange={() => onCheckboxChange(id)}
                        value={selectedPlugins?.has(id)}
                        disabled={!pluginsNotInstalled.has(id)}
                      />
                    </td>
                    <td>{name}</td>
                    <td>{installedVersion}</td>
                    <td>{latestVersion}</td>
                    <td className={styles.icon}>
                      <StatusIcon
                        id={id}
                        inProgress={inProgress}
                        isSelected={selectedPlugins?.has(id) ?? false}
                        isInstalled={!pluginsNotInstalled.has(id)}
                        errorMap={errorMap}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {numberInstalled > 0 && installationFinished && (
            <div className={styles.pluginsInstalled}>
              <Icon className={styles.successIcon} size="lg" name="check" />
              {`${numberInstalled} ${t('plugins.catalog.update-all.update-status-text', 'plugins updated')}`}
            </div>
          )}
          {errorMap.size > 0 && installationFinished && (
            <div className={styles.pluginsInstalled}>
              <Icon className={styles.errorIcon} size="lg" name="exclamation-triangle" />
              {`${errorMap.size} ${t('plugins.catalog.update-all.error-status-text', 'failed - see error messages')}`}
            </div>
          )}
          {config.pluginAdminExternalManageEnabled && (
            <footer className={styles.footer}>
              <Trans i18nKey="plugins.catalog.update-all.cloud-update-message">
                * It may take a few minutes for the plugins to be available for usage.
              </Trans>
            </footer>
          )}
        </>
      )}
    </div>
  );
};
