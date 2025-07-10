import { useEffect, useMemo, useRef, useState } from 'react';

import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';

import { useInstall, useInstallStatus } from '../state/hooks';
import { CatalogPlugin, PluginStatus } from '../types';

import { UpdateModalBody } from './UpdateAllModalBody';
const PLUGINS_UPDATE_ALL_INTERACTION_EVENT_NAME = 'plugins_update_all_clicked';

type UpdateError = {
  id: string;
  message: string;
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
  const initialPluginsRef = useRef(plugins);

  const pluginsSet = useMemo(() => new Set(plugins.map((plugin) => plugin.id)), [plugins]);
  const installsRemaining = plugins.length;

  // Since the plugins come from the store and changes every time we update a plugin,
  // we need to keep track of the initial plugins.
  useEffect(() => {
    if (initialPluginsRef.current.length === 0) {
      initialPluginsRef.current = [...plugins];
    }
  }, [plugins]);

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
      reportInteraction(PLUGINS_UPDATE_ALL_INTERACTION_EVENT_NAME, {
        path: window.location.pathname,
        count: selectedPlugins?.size,
        creator_team: 'grafana_plugins_catalog',
        schema_version: '1.0.0',
      });

      setInProgress(true);

      // in cloud the requests need to be sync
      if (config.pluginAdminExternalManageEnabled) {
        for (let plugin of plugins) {
          if (selectedPlugins?.has(plugin.id)) {
            await install(plugin.id, plugin.latestVersion, PluginStatus.UPDATE);
          }
        }
      } else {
        plugins.forEach((plugin) => {
          if (selectedPlugins?.has(plugin.id)) {
            install(plugin.id, plugin.latestVersion, PluginStatus.UPDATE);
          }
        });
      }
    }
  };

  const onDismissClick = () => {
    initialPluginsRef.current = [];
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
        <UpdateModalBody
          plugins={initialPluginsRef.current}
          pluginsNotInstalled={pluginsSet}
          inProgress={inProgress}
          errorMap={errorMap}
          onCheckboxChange={onCheckboxChange}
          selectedPlugins={selectedPlugins}
        />
      }
      onConfirm={installsRemaining > 0 ? onConfirm : onDismissClick}
      onDismiss={onDismissClick}
      disabled={shouldDisableConfirm(inProgress, installsRemaining, pluginsSelected)}
      confirmText={getConfirmationText(installsRemaining, inProgress, pluginsSelected)}
      confirmButtonVariant="primary"
    />
  );
};

function getConfirmationText(installsRemaining: number, inProgress: boolean, pluginsSelected: number) {
  if (inProgress) {
    return t('plugins.catalog.update-all.modal-in-progress', 'Updating...');
  }

  if (installsRemaining > 0) {
    return t('plugins.catalog.update-all.modal-confirmation', 'Update') + ` (${pluginsSelected})`;
  }
  return t('plugins.catalog.update-all.modal-dismiss', 'Close');
}

function shouldDisableConfirm(inProgress: boolean, installsRemaining: number, pluginsSelected: number) {
  if (inProgress) {
    return true;
  }

  if (installsRemaining > 0 && pluginsSelected === 0) {
    return true;
  }

  return false;
}

export default UpdateAllModal;
