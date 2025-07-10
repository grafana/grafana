import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Spinner, useStyles2 } from '@grafana/ui';
import { useGetPublicDashboardQuery } from 'app/features/dashboard/api/publicDashboardApi';
import { publicDashboardPersisted } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { ShareModalTabProps } from 'app/features/dashboard/components/ShareModal/types';
import { useSelector } from 'app/types/store';

import { HorizontalGroup } from '../../../../plugins/admin/components/HorizontalGroup';

import { ConfigPublicDashboard } from './ConfigPublicDashboard/ConfigPublicDashboard';
import { CreatePublicDashboard } from './CreatePublicDashboard/CreatePublicDashboard';
import { useGetUnsupportedDataSources } from './useGetUnsupportedDataSources';

interface Props extends ShareModalTabProps {}

export const Loader = () => {
  const styles = useStyles2(getStyles);

  return (
    <HorizontalGroup className={styles.loadingContainer}>
      <>
        <Trans i18nKey="dashboard.share-public-dashboard-loader.loading-configuration">Loading configuration</Trans>
        <Spinner size="lg" className={styles.spinner} />
      </>
    </HorizontalGroup>
  );
};

export const SharePublicDashboard = (props: Props) => {
  const { data: publicDashboard, isLoading, isError } = useGetPublicDashboardQuery(props.dashboard.uid);
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;
  const { unsupportedDataSources } = useGetUnsupportedDataSources(dashboard);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : !publicDashboardPersisted(publicDashboard) ? (
        <CreatePublicDashboard hasError={isError} />
      ) : (
        <ConfigPublicDashboard publicDashboard={publicDashboard!} unsupportedDatasources={unsupportedDataSources} />
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  loadingContainer: css({
    height: '280px',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
  }),
  spinner: css({
    marginBottom: theme.spacing(0),
  }),
});
