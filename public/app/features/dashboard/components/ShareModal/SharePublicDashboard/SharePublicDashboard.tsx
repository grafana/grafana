import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { ModalsController, Spinner, useStyles2 } from '@grafana/ui/src';
import { contextSrv } from 'app/core/core';
import {
  useCreatePublicDashboardMutation,
  useDeletePublicDashboardMutation,
  useGetPublicDashboardQuery,
  useUpdatePublicDashboardMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import {
  dashboardHasTemplateVariables,
  publicDashboardPersisted,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { ShareModalTabProps } from 'app/features/dashboard/components/ShareModal/types';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';
import { DeletePublicDashboardModal } from 'app/features/manage-dashboards/components/PublicDashboardListTable/DeletePublicDashboardModal';
import { AccessControlAction, useSelector } from 'app/types';

import { HorizontalGroup } from '../../../../plugins/admin/components/HorizontalGroup';
import { ShareModal } from '../ShareModal';
import { trackDashboardSharingActionPerType } from '../analytics';
import { shareDashboardType } from '../utils';

import ConfigPublicDashboard from './ConfigPublicDashboard/ConfigPublicDashboard';
import CreatePublicDashboard from './CreatePublicDashboard/CreatePublicDashboard';
import { useGetUnsupportedDataSources } from './useGetUnsupportedDataSources';

interface Props extends ShareModalTabProps {}

export const Loader = () => {
  const styles = useStyles2(getStyles);

  return (
    <HorizontalGroup className={styles.loadingContainer}>
      <>
        Loading configuration
        <Spinner size="lg" className={styles.spinner} />
      </>
    </HorizontalGroup>
  );
};

export const SharePublicDashboard = (props: Props) => {
  const { data: publicDashboard, isLoading: isGetLoading, isError } = useGetPublicDashboardQuery(props.dashboard.uid);
  const [createPublicDashboard, { isLoading: isSaveLoading }] = useCreatePublicDashboardMutation();
  const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();
  const [deletePublicDashboard, { isLoading: isDeleteLoading }] = useDeletePublicDashboardMutation();
  const isLoading = isGetLoading || isSaveLoading || isDeleteLoading;
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;
  const { unsupportedDataSources } = useGetUnsupportedDataSources(dashboard);
  const timeRange = getTimeRange(dashboard.getDefaultTime(), dashboard);
  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
  const hasTemplateVariables = dashboardHasTemplateVariables(dashboard.getVariables());

  const onDeletePublicDashboardClick = (onDelete: () => void) => {
    deletePublicDashboard({
      dashboard,
      uid: publicDashboard!.uid,
      dashboardUid: dashboard.uid,
    });
    onDelete();
  };

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : !publicDashboardPersisted(publicDashboard) ? (
        <CreatePublicDashboard
          isLoading={isSaveLoading}
          isError={isError}
          unsupportedTemplateVariables={hasTemplateVariables}
          unsupportedDatasources={unsupportedDataSources}
          onCreate={() => {
            trackDashboardSharingActionPerType('generate_public_url', shareDashboardType.publicDashboard);
            createPublicDashboard({ dashboard, payload: { isEnabled: true } });
          }}
        />
      ) : (
        <ModalsController>
          {({ showModal, hideModal }) => (
            <ConfigPublicDashboard
              publicDashboard={publicDashboard}
              unsupportedDatasources={unsupportedDataSources}
              isLoading={isLoading || isUpdateLoading}
              timeRange={timeRange}
              showSaveChangesAlert={hasWritePermissions && dashboard.hasUnsavedChanges()}
              hasTemplateVariables={hasTemplateVariables}
              onUpdate={(updatedPublicDashboard) => {
                update({ dashboard, payload: updatedPublicDashboard });
              }}
              onRevoke={() => {
                showModal(DeletePublicDashboardModal, {
                  dashboardTitle: dashboard.title,
                  onConfirm: () => onDeletePublicDashboardClick(hideModal),
                  onDismiss: () => {
                    showModal(ShareModal, {
                      dashboard,
                      onDismiss: hideModal,
                      activeTab: shareDashboardType.publicDashboard,
                    });
                  },
                });
              }}
            />
          )}
        </ModalsController>
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
