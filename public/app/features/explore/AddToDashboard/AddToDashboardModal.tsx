import React, { useState } from 'react';
import { Button, Field, Modal, RadioButtonGroup } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { addPanelToDashboard, SaveTarget } from './addToDashboard';
import { useSelector } from 'react-redux';
import { ExploreId, StoreState } from 'app/types';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';

const SAVE_TARGETS: Array<SelectableValue<SaveTarget>> = [
  {
    label: 'New Dashboard',
    value: SaveTarget.NewDashboard,
  },
  {
    label: 'Existing Dashboard',
    value: SaveTarget.ExistingDashboard,
  },
];

interface Props {
  onClose: () => void;
  exploreId: ExploreId;
}

export const AddToDashboardModal = ({ onClose, exploreId }: Props) => {
  const [targetMode, setTargetMode] = useState<SaveTarget>(SaveTarget.NewDashboard);
  const [dashboardUid, setDashboardUid] = useState<string | undefined>(undefined);
  const state = useSelector((state: StoreState) => state);

  const onOpen = () => {
    addPanelToDashboard({
      exploreItem: state.explore[exploreId]!,
      targetMode,
      dashboardUid,
    });
    onClose();
  };

  const onOpenInNewTab = () => {
    addPanelToDashboard({
      exploreItem: state.explore[exploreId]!,
      openInNewTab: true,
      targetMode,
      dashboardUid,
    });
    onClose();
  };

  // If we are not in new dashboard mode we have to have picked a dashboard
  const isValid = targetMode === SaveTarget.NewDashboard || dashboardUid !== undefined;

  return (
    <Modal title="Add panel to dashboard" onDismiss={onClose} isOpen>
      <Field>
        <RadioButtonGroup options={SAVE_TARGETS} value={targetMode} onChange={setTargetMode} />
      </Field>

      {targetMode === SaveTarget.ExistingDashboard && (
        <Field label="Dashboard" description="Select in which dashboard the panel will be created.">
          <DashboardPicker
            value={dashboardUid}
            onChange={(value) => setDashboardUid(value?.uid)}
            inputId="e2d-dashboard-picker"
          />
        </Field>
      )}

      <Modal.ButtonRow>
        <Button type="reset" onClick={onClose} fill="outline" variant="secondary">
          Cancel
        </Button>
        <Button onClick={onOpenInNewTab} variant="secondary" disabled={!isValid}>
          Open in new tab
        </Button>
        <Button onClick={onOpen} variant="primary" disabled={!isValid}>
          Open
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
