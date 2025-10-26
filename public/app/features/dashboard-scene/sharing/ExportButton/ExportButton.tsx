import { useCallback, useState } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, ButtonGroup, Dropdown, Icon } from '@grafana/ui';

import { DashboardScene } from '../../scene/DashboardScene';

import ExportMenu from './ExportMenu';

interface Props {
  dashboard: DashboardScene;
}

export default function ExportButton({ dashboard }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const onMenuClick = useCallback((isOpen: boolean) => {
    setIsOpen(isOpen);
  }, []);

  const MenuActions = () => <ExportMenu dashboard={dashboard} />;

  return (
    <ButtonGroup>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={onMenuClick}>
        <Button
          size="sm"
          variant="secondary"
          fill="solid"
          tooltip={t('export.menu.export-as-json-tooltip', 'Export')}
          aria-label={t('dashboard.export.button.label', 'Export dashboard')}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          data-testid={e2eSelectors.pages.Dashboard.DashNav.NewExportButton.arrowMenu}
        >
          <Trans i18nKey="export.menu.export-as-json-label">Export</Trans>&nbsp;
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} size="sm" aria-hidden="true" />
        </Button>
      </Dropdown>
    </ButtonGroup>
  );
}
