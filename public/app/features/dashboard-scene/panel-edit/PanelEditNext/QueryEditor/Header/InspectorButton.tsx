import { useCallback } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import { InspectTab } from 'app/features/inspector/types';

import { PanelInspectDrawer } from '../../../../inspect/PanelInspectDrawer';
import { getDashboardSceneFor } from '../../../../utils/utils';
import { usePanelContext } from '../QueryEditorContext';

export function InspectorButton() {
  const { panel } = usePanelContext();

  const onOpenInspector = useCallback(() => {
    const dashboard = getDashboardSceneFor(panel);
    dashboard.showModal(new PanelInspectDrawer({ panelRef: panel.getRef(), currentTab: InspectTab.Query }));
  }, [panel]);

  return (
    <Button
      size="sm"
      fill="text"
      icon="brackets-curly"
      variant="secondary"
      onClick={onOpenInspector}
      tooltip={t('query-editor.action.inspector', 'Query inspector')}
    >
      <Trans i18nKey="query-editor.action.inspector">Inspector</Trans>
    </Button>
  );
}
