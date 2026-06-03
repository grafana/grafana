import { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Modal, ToolbarButton } from '@grafana/ui';
import { EditDataSource } from 'app/features/datasources/components/EditDataSource';

import { getDsRefsFromScene } from '../../../utils/dashboardDsRefs';
import { type ToolbarActionProps } from '../types';

// HACK flow: assume the dashboard uses a single datasource and let the user open
// its config editor directly from the dashboard toolbar.
export const EditDatasourceButton = ({ dashboard }: ToolbarActionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Resolve the (first) datasource used by the dashboard to a concrete uid.
  const dsUid = useMemo(() => {
    const refs = getDsRefsFromScene(dashboard);
    // eslint-disable-next-line no-console
    console.log('[EditDatasourceButton] refs:', refs);
    for (const ref of refs) {
      const instance = getDataSourceSrv().getInstanceSettings(ref);
      if (instance && instance.uid) {
        return instance.uid;
      }
    }
    // Panels using the default datasource don't carry an explicit ref, so fall
    // back to whatever the default datasource resolves to.
    return getDataSourceSrv().getInstanceSettings(null)?.uid;
  }, [dashboard]);

  // eslint-disable-next-line no-console
  console.log('[EditDatasourceButton] mounted, dsUid =', dsUid);

  if (!dsUid) {
    return null;
  }
  return (
    <>
      <ToolbarButton
        key="edit-datasource-button"
        icon="pen"
        variant="canvas"
        tooltip={t('dashboard.toolbar.edit-datasource.tooltip', 'Edit dashboard datasource')}
        onClick={() => setIsOpen(true)}
      >
        {t('dashboard.toolbar.edit-datasource.label', 'Datasource')}
      </ToolbarButton>
      {isOpen && (
        <Modal
          title={t('dashboard.toolbar.edit-datasource.modal-title', 'Edit datasource')}
          isOpen={isOpen}
          onDismiss={() => setIsOpen(false)}
        >
          <EditDataSource uid={dsUid} onDone={() => setIsOpen(false)} />
        </Modal>
      )}
    </>
  );
};
