import { css } from '@emotion/css';
import React from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Checkbox, FieldSet, Spinner, Stack, useStyles2 } from '@grafana/ui';

import { contextSrv } from '../../../../../../core/services/context_srv';
import { AccessControlAction } from '../../../../../../types';
import { useCreatePublicDashboardMutation } from '../../../../../dashboard/api/publicDashboardApi';
import { PublicDashboardShareType } from '../../../../../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from '../../../../scene/DashboardScene';
import { DashboardInteractions } from '../../../../utils/interactions';

const PUBLIC_DASHBOARD_URL = 'https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/';
export default function CreatePublicSharing({
  dashboard,
  onCancel,
  hasError,
}: {
  dashboard: DashboardScene;
  onCancel: () => void;
  hasError: boolean;
}) {
  const styles = useStyles2(getStyles);

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  const {
    handleSubmit,
    register,
    formState: { isValid },
  } = useForm<{ publicAcknowledgment: boolean }>({ mode: 'onChange' });

  const [createPublicDashboard, { isLoading, isError }] = useCreatePublicDashboardMutation();
  const onCreate = () => {
    createPublicDashboard({ dashboard, payload: { share: PublicDashboardShareType.PUBLIC, isEnabled: true } });
    DashboardInteractions.generatePublicDashboardUrlClicked({ share: PublicDashboardShareType.PUBLIC });
  };

  const disableInputs = !hasWritePermissions || isLoading || isError || hasError;

  return (
    <>
      {hasWritePermissions && (
        <Alert
          title=""
          severity="warning"
          buttonContent={<span>Learn more</span>}
          onRemove={() => window.open(PUBLIC_DASHBOARD_URL, '_blank')}
          bottomSpacing={0}
        >
          Sharing this dashboard externally makes it entirely accessible to anyone with the link. Currently, this
          feature is limited to some data sources.
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
            <Button variant="secondary" onClick={onCancel}>
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
