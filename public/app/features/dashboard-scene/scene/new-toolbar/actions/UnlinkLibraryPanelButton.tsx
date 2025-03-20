import { selectors } from '@grafana/e2e-selectors';
import { Button } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ToolbarActionProps } from '../types';

export const UnlinkLibraryPanelButton = ({ dashboard }: ToolbarActionProps) => (
  <Button
    onClick={() => dashboard.state.editPanel?.onUnlinkLibraryPanel()}
    tooltip={t('dashboard.toolbar.new.unlink-library-panel', 'Unlink library panel')}
    size="sm"
    fill="outline"
    variant="secondary"
    data-testid={selectors.components.NavToolbar.editDashboard.unlinkLibraryPanelButton}
  >
    <Trans i18nKey="dashboard.toolbar.new.unlink-library-panel">Unlink library panel</Trans>
  </Button>
);
