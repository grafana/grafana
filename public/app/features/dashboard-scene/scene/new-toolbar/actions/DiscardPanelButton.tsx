import { useEffect, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { PanelEditor } from '../../../panel-edit/PanelEditor';
import { ToolbarActionProps } from '../types';

export const DiscardPanelButton = ({ dashboard }: ToolbarActionProps) => {
  const isEditedPanelDirty = usePanelEditDirty(dashboard.state.editPanel);

  return (
    <Button
      onClick={() => dashboard.state.editPanel?.onDiscard()}
      tooltip={
        dashboard.state.editPanel?.state.isNewPanel
          ? t('dashboard.toolbar.new.discard-panel-new', 'Discard panel')
          : t('dashboard.toolbar.new.discard-panel', 'Discard panel changes')
      }
      size="sm"
      disabled={!isEditedPanelDirty}
      fill="outline"
      variant="destructive"
      data-testid={selectors.components.NavToolbar.editDashboard.discardChangesButton}
    >
      {dashboard.state.editPanel?.state.isNewPanel ? (
        <Trans i18nKey="dashboard.toolbar.new.discard-panel-new">Discard panel</Trans>
      ) : (
        <Trans i18nKey="dashboard.toolbar.new.discard-panel">Discard panel changes</Trans>
      )}
    </Button>
  );
};

function usePanelEditDirty(panelEditor?: PanelEditor) {
  const [isDirty, setIsDirty] = useState<Boolean | undefined>();

  useEffect(() => {
    if (panelEditor) {
      const unsub = panelEditor.subscribeToState((state) => {
        if (state.isDirty !== isDirty) {
          setIsDirty(state.isDirty);
        }
      });

      return () => unsub.unsubscribe();
    }

    return;
  }, [panelEditor, isDirty]);

  return isDirty;
}
