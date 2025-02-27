import { Icon, IconButton, Stack, Text, TextLink } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { DashboardDataDTO } from 'app/types';

import { makeDashboardLink, makePanelLink } from '../../utils/misc';

import { PanelDTO } from './DashboardPicker';

const DashboardAnnotationField = ({
  dashboard,
  panel,
  dashboardUid,
  panelId,
  onEditClick,
  onDeleteClick,
}: {
  dashboard?: DashboardDataDTO;
  panel?: PanelDTO;
  dashboardUid: string; //fallback
  panelId: string; //fallback
  onEditClick: () => void;
  onDeleteClick: () => void;
}) => {
  const dashboardLink = makeDashboardLink(dashboard?.uid || dashboardUid);
  const panelLink = makePanelLink(dashboard?.uid || dashboardUid, panel?.id?.toString() || panelId);

  return (
    <Stack direction="row" alignItems="center">
      {dashboard && (
        <TextLink href={dashboardLink} data-testid="dashboard-annotation" external inline={false} variant="bodySmall">
          {dashboard.title}
        </TextLink>
      )}

      {panel && (
        <>
          {' · '}
          <TextLink href={panelLink} data-testid="panel-annotation" external inline={false} variant="bodySmall">
            {panel.title || '<No title>'}
          </TextLink>
        </>
      )}

      {!dashboard && (
        <Text color="secondary" variant="bodySmall">
          <Icon name="apps" size="sm" /> <Trans i18nKey="alerting.common.dashboard">Dashboard</Trans> {dashboardUid}
        </Text>
      )}

      {!panel && (
        <Text color="secondary" variant="bodySmall">
          {' - '}
          <Trans i18nKey="alerting.common.panel">Panel</Trans> {panelId}
        </Text>
      )}

      {(dashboard || panel) && (
        <>
          <IconButton
            name="pen"
            onClick={onEditClick}
            variant="secondary"
            aria-label={t('alerting.common.edit', 'Edit')}
          />
          <IconButton
            name="trash-alt"
            onClick={onDeleteClick}
            variant="secondary"
            aria-label={t('alerting.common.delete', 'Delete')}
          />
        </>
      )}
    </Stack>
  );
};

export default DashboardAnnotationField;
