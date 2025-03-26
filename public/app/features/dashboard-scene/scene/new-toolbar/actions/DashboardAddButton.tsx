import { selectors } from '@grafana/e2e-selectors';
import { Button } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ToolbarActionProps } from '../types';

export function DashboardAddButton({ dashboard }: ToolbarActionProps) {
  return (
    <Button
      tooltip={t('dashboard.toolbar.add-new.tooltip', 'Add panels and other elements')}
      icon="plus"
      onClick={() => dashboard.state.editPane.toggleAddPane()}
      variant="primary"
      size="sm"
      fill="outline"
      data-testid={selectors.components.PageToolbar.itemButton('Add button')}
    >
      <Trans i18nKey="dashboard.toolbar.add">Add</Trans>
    </Button>
  );
}
