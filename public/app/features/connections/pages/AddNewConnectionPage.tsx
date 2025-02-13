import { useState } from 'react';

import { PluginType } from '@grafana/data';
import { Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { Trans } from 'app/core/internationalization';
import UpdateAllModal from 'app/features/plugins/admin/components/UpdateAllModal';
import { useGetUpdatable } from 'app/features/plugins/admin/state/hooks';

import { AddNewConnection } from '../tabs/ConnectData';

export function AddNewConnectionPage() {
  const { isLoading: areUpdatesLoading, updatablePlugins } = useGetUpdatable();
  const updatableDSPlugins = updatablePlugins.filter((plugin) => plugin.type === PluginType.datasource);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const disableUpdateAllButton = updatableDSPlugins.length <= 0 || areUpdatesLoading;

  const onUpdateAll = () => {
    setShowUpdateModal(true);
  };

  const updateAll = (
    <Button disabled={disableUpdateAllButton} onClick={onUpdateAll}>
      <Trans i18nKey="plugins.catalog.update-all.button">Update all</Trans>
      {disableUpdateAllButton ? '' : ` (${updatableDSPlugins.length})`}
    </Button>
  );
  return (
    <Page navId={'connections-add-new-connection'} actions={updateAll}>
      <Page.Contents>
        <AddNewConnection />
        <UpdateAllModal
          isOpen={showUpdateModal}
          isLoading={areUpdatesLoading}
          onDismiss={() => setShowUpdateModal(false)}
          plugins={updatableDSPlugins}
        />
      </Page.Contents>
    </Page>
  );
}
