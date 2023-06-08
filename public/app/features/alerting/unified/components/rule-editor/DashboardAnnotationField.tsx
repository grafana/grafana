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
  onEditClick,
  onDeleteClick,
}: {
  dashboard: DashboardDataDTO;
  panel?: PanelDTO;
  onEditClick: () => void;
  onDeleteClick: () => void;
}) => {
  const styles = useStyles2(getStyles);

  const dashboardLink = makeDashboardLink(dashboard.uid);
  const panelLink = makePanelLink(dashboard.uid, panel?.id.toString() || '');
  return (
    <>
      <a href={dashboardLink} className={styles.link} target="_blank" rel="noreferrer">
        {dashboard.title} <Icon name={'external-link-alt'} />
      </a>
      <a href={panelLink} className={styles.link} target="_blank" rel="noreferrer">
        {panel?.title} <Icon name={'external-link-alt'} />
      </a>

      <Icon name={'pen'} onClick={onEditClick} className={styles.icon} />
      <Icon name={'trash-alt'} onClick={onDeleteClick} className={styles.icon} />
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
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
