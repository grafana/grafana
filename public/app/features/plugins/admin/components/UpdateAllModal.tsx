import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Checkbox, ConfirmModal, EmptyState, Icon, Spinner, Tooltip, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { useInstall, useInstallStatus } from '../state/hooks';
import { CatalogPlugin } from '../types';

type UpdateError = {
  id: string;
  message: string;
};

function getIcon({
  id,
  inProgress,
  errorMap,
  selectedPlugins,
}: {
  id: string;
  inProgress: boolean;
  errorMap: Map<string, UpdateError>;
  selectedPlugins?: Set<string>;
}) {
  if (errorMap && errorMap.has(id)) {
    return (
      <Tooltip
        content={`${t('plugins.catalog.update-all.error', 'Error updating plugin:')} ${errorMap.get(id)?.message}`}
      >
        <Icon size="xl" name="exclamation-circle" />
      </Tooltip>
    );
  }
  if (inProgress && selectedPlugins?.has(id)) {
    return <Spinner />;
  }
  return '';
}

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
    height: theme.spacing(32),
  }),
  modalContainer: css({
    height: theme.spacing(41),
  }),
});

type ModalBodyProps = {
  plugins: CatalogPlugin[];
  inProgress: boolean;
  selectedPlugins?: Set<string>;
  onCheckboxChange: (id: string) => void;
  errorMap: Map<string, UpdateError>;
};

const ModalBody = ({ plugins, inProgress, selectedPlugins, onCheckboxChange, errorMap }: ModalBodyProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.modalContainer}>
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
                      <Checkbox onChange={() => onCheckboxChange(id)} value={selectedPlugins?.has(id)} />
                    </td>
                    <td>{name}</td>
                    <td>{installedVersion}</td>
                    <td>{latestVersion}</td>
                    <td className={styles.icon}>{getIcon({ id, inProgress, errorMap, selectedPlugins })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {config.pluginAdminExternalManageEnabled && config.featureToggles.managedPluginsInstall && (
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

type Props = {
  isOpen: boolean;
  isLoading: boolean;
  onDismiss: () => void;
  plugins: CatalogPlugin[];
};

export const UpdateAllModal = ({ isOpen, onDismiss, isLoading, plugins }: Props) => {
  const install = useInstall();
  const { error } = useInstallStatus();
  const [errorMap, setErrorMap] = useState(new Map<string, UpdateError>());
  const [inProgress, setInProgress] = useState(false);
  const [selectedPlugins, setSelectedPlugins] = useState<Set<string>>();

  const pluginsSet = useMemo(() => new Set(plugins.map((plugin) => plugin.id)), [plugins]);
  const installsRemaining = plugins.length;

  // Updates the component state on every plugins change, since the installation will change the store content
  useEffect(() => {
    if (inProgress) {
      selectedPlugins?.forEach((id) => {
        if (!pluginsSet.has(id)) {
          setSelectedPlugins((prevSelectedPlugins) => {
            const newSelectedPlugins = new Set(prevSelectedPlugins);
            newSelectedPlugins.delete(id);
            return newSelectedPlugins;
          });
        }
      });

      if (selectedPlugins?.size === 0) {
        setInProgress(false);
      }
    }
  }, [inProgress, pluginsSet, selectedPlugins]);

  // Initialize the component with all the plugins selected
  useEffect(() => {
    if (selectedPlugins === undefined && plugins.length > 0 && !isLoading) {
      const initialSelectedPlugins = new Set(plugins.map((plugin) => plugin.id));
      setSelectedPlugins(initialSelectedPlugins);
    }
  }, [isLoading, plugins, selectedPlugins]);

  // Updates the component state on every error that comes from the store
  useEffect(() => {
    if (inProgress && error && !errorMap.has(error.id) && selectedPlugins?.has(error.id)) {
      setErrorMap((prevErrorMap) => {
        const newErrorMap = new Map(prevErrorMap);
        newErrorMap.set(error.id, error);
        return newErrorMap;
      });

      setSelectedPlugins((prevSelectedPlugins) => {
        const newSelectedPlugins = new Set(prevSelectedPlugins);
        newSelectedPlugins.delete(error.id);
        return newSelectedPlugins;
      });
    }
  }, [error, errorMap, inProgress, selectedPlugins]);

  const onConfirm = async () => {
    if (!inProgress) {
      setInProgress(true);

      // in cloud the requests need to be sync
      if (config.pluginAdminExternalManageEnabled && config.featureToggles.managedPluginsInstall) {
        for (let plugin of plugins) {
          if (selectedPlugins?.has(plugin.id)) {
            await install(plugin.id, plugin.latestVersion, true);
          }
        }
      } else {
        plugins.forEach((plugin) => {
          if (selectedPlugins?.has(plugin.id)) {
            install(plugin.id, plugin.latestVersion, true);
          }
        });
      }
    }
  };

  const onDismissClick = () => {
    setErrorMap(new Map());
    setInProgress(false);
    setSelectedPlugins(undefined);
    onDismiss();
  };

  const onCheckboxChange = (id: string) => {
    setSelectedPlugins((prevSelectedPlugins) => {
      const newSelectedPlugins = new Set(prevSelectedPlugins);
      if (newSelectedPlugins.has(id)) {
        newSelectedPlugins.delete(id);
      } else {
        newSelectedPlugins.add(id);
      }
      return newSelectedPlugins;
    });
    if (errorMap.has(id)) {
      setErrorMap((prevErrorMap) => {
        const newErrorMap = new Map(prevErrorMap);
        newErrorMap.delete(id);
        return newErrorMap;
      });
    }
  };

  const pluginsSelected = selectedPlugins?.size || 0;

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('plugins.catalog.update-all.modal-title', 'Update Plugins')}
      body={
        <ModalBody
          plugins={plugins}
          inProgress={inProgress}
          errorMap={errorMap}
          onCheckboxChange={onCheckboxChange}
          selectedPlugins={selectedPlugins}
        />
      }
      onConfirm={installsRemaining > 0 ? onConfirm : onDismissClick}
      onDismiss={onDismissClick}
      disabled={pluginsSelected === 0 || inProgress}
      confirmText={
        installsRemaining > 0
          ? `${t('plugins.catalog.update-all.modal-confirmation', 'Update')} (${pluginsSelected})`
          : t('plugins.catalog.update-all.modal-dismiss', 'Close')
      }
    />
  );
};

export default UpdateAllModal;
