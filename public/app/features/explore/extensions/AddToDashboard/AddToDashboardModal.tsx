import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { Modal } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

import { AddToDashboardBody } from './AddToDashboardBody';

enum SaveTarget {
  NewDashboard = 'new-dashboard',
  ExistingDashboard = 'existing-dashboard',
}

interface SaveTargetDTO {
  saveTarget: SaveTarget;
}
interface SaveToNewDashboardDTO extends SaveTargetDTO {
  saveTarget: SaveTarget.NewDashboard;
}

interface SaveToExistingDashboard extends SaveTargetDTO {
  saveTarget: SaveTarget.ExistingDashboard;
  dashboardUid: string;
}

type FormDTO = SaveToNewDashboardDTO | SaveToExistingDashboard;

interface Props {
  onClose: () => void;
  exploreId: string;
  excludeModal?: boolean;
}

export const AddToDashboardModal = ({ onClose, exploreId, excludeModal = false }: Props) => {
  const methods = useForm<FormDTO>({
    defaultValues: { saveTarget: SaveTarget.NewDashboard },
  });

  const canCreateDashboard = contextSrv.hasAccess(AccessControlAction.DashboardsCreate, contextSrv.isEditor);
  const canWriteDashboard = contextSrv.hasAccess(AccessControlAction.DashboardsWrite, contextSrv.isEditor);

  const saveTargets: Array<SelectableValue<SaveTarget>> = [];
  if (canCreateDashboard) {
    saveTargets.push({
      label: 'New dashboard',
      value: SaveTarget.NewDashboard,
    });
  }
  if (canWriteDashboard) {
    saveTargets.push({
      label: 'Existing dashboard',
      value: SaveTarget.ExistingDashboard,
    });
  }

  const modalTitle = `Add panel to ${saveTargets.length > 1 ? 'dashboard' : saveTargets[0].label!.toLowerCase()}`;

  if (excludeModal) {
    return (
      <FormProvider {...methods}>
        <AddToDashboardBody saveTargets={saveTargets} onClose={onClose} exploreId={exploreId} />
      </FormProvider>
    );
  }

  return (
    <Modal title={modalTitle} onDismiss={onClose} isOpen>
      <FormProvider {...methods}>
        <AddToDashboardBody saveTargets={saveTargets} onClose={onClose} exploreId={exploreId} />
      </FormProvider>
    </Modal>
  );
};
