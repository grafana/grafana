import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Text, useStyles2 } from '@grafana/ui';

import { makeDashboardLink, makePanelLink } from '../../utils/misc';

import { PanelDTO, getDashboardTitle, getDashboardUid } from './DashboardPicker';
import { DashboardResponse } from './useDashboardQuery';

const DashboardAnnotationField = ({
  dashboard,
  panel,
  dashboardUid,
  panelId,
  onEditClick,
  onDeleteClick,
}: {
  dashboard?: DashboardResponse;
  panel?: PanelDTO;
  dashboardUid: string; //fallback
  panelId: string; //fallback
  onEditClick: () => void;
  onDeleteClick: () => void;
}) => {
  const styles = useStyles2(getStyles);

  const dashboardLink = makeDashboardLink(getDashboardUid(dashboard) || dashboardUid);
  const panelLink = makePanelLink(getDashboardUid(dashboard) || dashboardUid, panel?.id?.toString() || panelId);
  return (
    <div className={styles.container}>
      {dashboard && (
        <a
          href={dashboardLink}
          className={styles.link}
          target="_blank"
          rel="noreferrer"
          data-testid="dashboard-annotation"
        >
          {getDashboardTitle(dashboard)} <Icon name={'external-link-alt'} />
        </a>
      )}

      {!dashboard && (
        <Text color="secondary">
          <Trans i18nKey="alerting.annotations.dashboard-annotation-field.dashboard" values={{ dashboardUid }}>
            Dashboard {{ dashboardUid }}
          </Trans>
        </Text>
      )}

      {panel && (
        <a href={panelLink} className={styles.link} target="_blank" rel="noreferrer" data-testid="panel-annotation">
          {panel.title || '<No title>'} <Icon name={'external-link-alt'} />
        </a>
      )}

      {!panel && (
        <>
          <span> - </span>
          <Text color="secondary">
            <Trans i18nKey="alerting.annotations.dashboard-annotation-field.panel" values={{ panelId }}>
              Panel {{ panelId }}
            </Trans>
          </Text>
        </>
      )}

      {(dashboard || panel) && (
        <>
          <Icon name={'pen'} onClick={onEditClick} className={styles.icon} />
          <Icon name={'trash-alt'} onClick={onDeleteClick} className={styles.icon} />
        </>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginTop: '5px',
  }),

  noLink: css({
    color: theme.colors.text.secondary,
  }),
  link: css({
    color: theme.colors.text.link,
    marginRight: theme.spacing(1.5),
  }),

  icon: css({
    marginRight: theme.spacing(1),
    cursor: 'pointer',
  }),
});

export default DashboardAnnotationField;
