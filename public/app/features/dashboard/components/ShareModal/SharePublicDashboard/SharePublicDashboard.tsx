import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { reportInteraction } from '@grafana/runtime/src';
import { Spinner, useStyles2 } from '@grafana/ui/src';
import { useGetPublicDashboardQuery } from 'app/features/dashboard/api/publicDashboardApi';
import { publicDashboardPersisted } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { ShareModalTabProps } from 'app/features/dashboard/components/ShareModal/types';

import { HorizontalGroup } from '../../../../plugins/admin/components/HorizontalGroup';

import ConfigPublicDashboard from './ConfigPublicDashboard/ConfigPublicDashboard';
import CreatePublicDashboard from './CreatePublicDashboard/CreatePublicDashboard';
interface Props extends ShareModalTabProps {}

const Loader = () => {
  const styles = useStyles2(getStyles);

  return (
    <HorizontalGroup className={styles.loadingContainer}>
      <>
        Loading configuration
        <Spinner size={20} className={styles.spinner} />
      </>
    </HorizontalGroup>
  );
};

export const SharePublicDashboard = (props: Props) => {
  const { data: publicDashboard, isLoading, isError } = useGetPublicDashboardQuery(props.dashboard.uid);

  useEffect(() => {
    reportInteraction('grafana_dashboards_public_share_viewed');
  }, []);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : !publicDashboardPersisted(publicDashboard) ? (
        <CreatePublicDashboard isError={isError} />
      ) : (
        <ConfigPublicDashboard />
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  loadingContainer: css`
    height: 280px;
    align-items: center;
    justify-content: center;
    gap: ${theme.spacing(1)};
  `,
  spinner: css`
    margin-bottom: ${theme.spacing(0)};
  `,
});
