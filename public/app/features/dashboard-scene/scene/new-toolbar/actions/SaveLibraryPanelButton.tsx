import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { ToolbarActionProps } from '../types';

export const SaveLibraryPanelButton = ({ dashboard }: ToolbarActionProps) => {
  return (
    <Button
      onClick={() => dashboard.state.editPanel?.onSaveLibraryPanel()}
      tooltip={t('dashboard.toolbar.new.save-library-panel', 'Save library panel')}
      size="sm"
      fill="outline"
      variant="primary"
      data-testid={selectors.components.NavToolbar.editDashboard.saveLibraryPanelButton}
    >
      <Trans i18nKey="dashboard.toolbar.new.save-library-panel">Save library panel</Trans>
    </Button>
  );
};
