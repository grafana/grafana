import { selectors } from '@grafana/e2e-selectors';
import { Button } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ToolbarActionProps } from '../types';

export const DiscardLibraryPanelButton = ({ dashboard }: ToolbarActionProps) => (
  <Button
    onClick={() => dashboard.state.editPanel?.onDiscard()}
    tooltip={t('dashboard.toolbar.new.discard-library-panel-changes', 'Discard library panel changes')}
    size="sm"
    fill="outline"
    variant="destructive"
    data-testid={selectors.components.NavToolbar.editDashboard.discardChangesButton}
  >
    <Trans i18nKey="dashboard.toolbar.new.discard-library-panel-changes">Discard library panel changes</Trans>
  </Button>
);
