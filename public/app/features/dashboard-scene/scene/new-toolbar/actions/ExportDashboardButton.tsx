import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Button, ButtonGroup, Dropdown, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { getTrackingSource, shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import ExportMenu from '../../../sharing/ExportButton/ExportMenu';
import { DashboardInteractions } from '../../../utils/interactions';
import { ToolbarActionProps } from '../types';

const newExportButtonSelector = e2eSelectors.pages.Dashboard.DashNav.NewExportButton;

export const ExportDashboardButton = ({ dashboard }: ToolbarActionProps) => {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);

  const onMenuClick = useCallback((isOpen: boolean) => {
    setIsOpen(isOpen);
  }, []);

  const MenuActions = () => <ExportMenu dashboard={dashboard} />;

  return (
    <ButtonGroup data-testid={newExportButtonSelector.container} className={styles.container}>
      <Button
        data-testid={newExportButtonSelector.container}
        size="sm"
        tooltip={t('export.menu.export-as-json-tooltip', 'Export')}
        variant="secondary"
        onClick={() => {
          locationService.partial({ shareView: shareDashboardType.export });

          DashboardInteractions.sharingCategoryClicked({
            item: shareDashboardType.export,
            shareResource: getTrackingSource(),
          });
        }}
      >
        <Trans i18nKey="export.menu.export-as-json-label">Export</Trans>
      </Button>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={onMenuClick}>
        <Button
          aria-label={t('export.menu.export-as-json-tooltip', 'Export')}
          data-testid={newExportButtonSelector.arrowMenu}
          size="sm"
          icon={isOpen ? 'angle-up' : 'angle-down'}
          variant="secondary"
        />
      </Dropdown>
    </ButtonGroup>
  );
};

function getStyles() {
  return {
    container: css({
      gap: 1,
    }),
  };
}
