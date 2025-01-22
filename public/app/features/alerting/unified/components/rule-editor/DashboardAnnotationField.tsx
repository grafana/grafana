import { Icon, IconButton, Stack, Text, TextLink } from '@grafana/ui';
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
          {' '}
          ·{' '}
          <TextLink href={panelLink} data-testid="panel-annotation" external inline={false} variant="bodySmall">
            {panel.title || '<No title>'}
          </TextLink>
        </>
      )}

      {!dashboard && (
        <Text color="secondary" variant="bodySmall">
          <Icon name="apps" size="sm" /> Dashboard {dashboardUid}
        </Text>
      )}

      {!panel && (
        <Text color="secondary" variant="bodySmall">
          {' '}
          - Panel {panelId}
        </Text>
      )}

      {(dashboard || panel) && (
        <>
          <IconButton name="pen" onClick={onEditClick} variant="secondary" aria-label="edit link" />
          <IconButton name="trash-alt" onClick={onDeleteClick} variant="secondary" aria-label="delete link" />
        </>
      )}
    </Stack>
  );
};

export default DashboardAnnotationField;
