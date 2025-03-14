import { useCallback, useState } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Button, ButtonGroup, Dropdown, Icon } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { DashboardScene } from '../../scene/DashboardScene';

import ExportMenu from './ExportMenu';

const newExportButtonSelector = e2eSelectors.pages.Dashboard.DashNav.NewExportButton;

interface Props {
  dashboard: DashboardScene;
  iconOnly?: boolean;
}

export default function ExportButton({ dashboard, iconOnly = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const onMenuClick = useCallback((isOpen: boolean) => {
    setIsOpen(isOpen);
  }, []);

  const MenuActions = () => <ExportMenu dashboard={dashboard} />;

  return (
    <ButtonGroup data-testid={newExportButtonSelector.container}>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={onMenuClick}>
        <Button
          data-testid={newExportButtonSelector.arrowMenu}
          size="sm"
          variant="secondary"
          fill="solid"
          tooltip={t('export.menu.export-as-json-tooltip', 'Export')}
        >
          {iconOnly ? (
            <Icon name="download-alt" size="sm" />
          ) : (
            <>
              <Trans i18nKey="export.menu.export-as-json-label">Export</Trans>&nbsp;
              <Icon name={isOpen ? 'angle-up' : 'angle-down'} size="sm" />
            </>
          )}
        </Button>
      </Dropdown>
    </ButtonGroup>
  );
}
