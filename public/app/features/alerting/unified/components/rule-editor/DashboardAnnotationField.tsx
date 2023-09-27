import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
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
  const styles = useStyles2(getStyles);

  const dashboardLink = makeDashboardLink(dashboard?.uid || dashboardUid);
  const panelLink = makePanelLink(dashboard?.uid || dashboardUid, panel?.id.toString() || panelId);
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
          {dashboard.title} <Icon name={'external-link-alt'} />
        </a>
      )}

      {!dashboard && <span className={styles.noLink}>Dashboard {dashboardUid} </span>}

      {panel && (
        <a href={panelLink} className={styles.link} target="_blank" rel="noreferrer" data-testid="panel-annotation">
          {panel.title || '<No title>'} <Icon name={'external-link-alt'} />
        </a>
      )}

      {!panel && <span className={styles.noLink}> - Panel {panelId}</span>}

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
  container: css`
    margin-top: 5px;
  `,

  noLink: css`
    color: ${theme.colors.text.secondary};
  `,
  link: css`
    color: ${theme.colors.text.link};
    margin-right: ${theme.spacing(1.5)};
  `,

  icon: css`
    margin-right: ${theme.spacing(1)};
    cursor: pointer;
  `,
});

export default DashboardAnnotationField;
