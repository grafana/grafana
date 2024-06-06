import { css } from '@emotion/css';
import React from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Checkbox, FieldSet, Spinner, Stack, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useCreatePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';
import { PublicDashboardShareType } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { AccessControlAction } from 'app/types';

import { useShareDrawerContext } from '../../../ShareDrawer/ShareDrawerContext';

const PUBLIC_DASHBOARD_URL = 'https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/';
export default function CreatePublicSharing({ hasError }: { hasError: boolean }) {
  const { dashboard } = useShareDrawerContext();
  const styles = useStyles2(getStyles);

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  const {
    handleSubmit,
    register,
    formState: { isValid },
  } = useForm<{ publicAcknowledgment: boolean }>({ mode: 'onChange' });

  const [createPublicDashboard, { isLoading, isError }] = useCreatePublicDashboardMutation();
  const onCreate = () => {
    DashboardInteractions.generatePublicDashboardUrlClicked({ share: PublicDashboardShareType.PUBLIC });
    createPublicDashboard({ dashboard, payload: { share: PublicDashboardShareType.PUBLIC, isEnabled: true } });
  };

  const disableInputs = !hasWritePermissions || isLoading || isError || hasError;

  return (
    <>
      {hasWritePermissions && (
        <Alert title="" severity="info" bottomSpacing={0}>
          <Stack justifyContent="space-between" gap={2} alignItems="center">
            Sharing this dashboard externally makes it entirely accessible to anyone with the link.
            <Button variant="secondary" onClick={() => window.open(PUBLIC_DASHBOARD_URL, '_blank')} type="button">
              Learn more
            </Button>
          </Stack>
        </Alert>
      )}
      <form onSubmit={handleSubmit(onCreate)}>
        <FieldSet disabled={disableInputs}>
          <div className={styles.checkbox}>
            <Checkbox
              {...register('publicAcknowledgment', { required: true })}
              label="I understand that this entire dashboard will be public.*"
            />
          </div>
          <Stack direction="row" gap={1} alignItems="center">
            <Button type="submit" disabled={!isValid}>
              Accept
            </Button>
            <Button variant="secondary" onClick={dashboard.closeModal}>
              Cancel
            </Button>
            {isLoading && <Spinner />}
          </Stack>
        </FieldSet>
      </form>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  checkbox: css({
    marginBottom: theme.spacing(2),
  }),
});
