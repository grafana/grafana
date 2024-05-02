import { css } from '@emotion/css';
import React from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Checkbox, FieldSet, Spinner, Stack } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/';

import { contextSrv } from '../../../../../../core/services/context_srv';
import { AccessControlAction } from '../../../../../../types';
import { useCreatePublicDashboardMutation } from '../../../../../dashboard/api/publicDashboardApi';
import { NoUpsertPermissionsAlert } from '../../../../../dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/NoUpsertPermissionsAlert';
import { PublicDashboardShareType } from '../../../../../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from '../../../../scene/DashboardScene';
import { DashboardInteractions } from '../../../../utils/interactions';

const EMAIL_SHARING_URL = 'https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/#email-sharing';

export const CreateEmailSharing = ({
  dashboard,
  onCancel,
  hasError,
}: {
  dashboard: DashboardScene;
  onCancel: () => void;
  hasError: boolean;
}) => {
  const styles = useStyles2(getStyles);

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  const {
    handleSubmit,
    register,
    formState: { isValid },
  } = useForm<{ billAcknowledgment: boolean }>({ mode: 'onChange' });

  const [createPublicDashboard, { isLoading, isError }] = useCreatePublicDashboardMutation();
  const onCreate = () => {
    createPublicDashboard({ dashboard, payload: { share: PublicDashboardShareType.EMAIL, isEnabled: true } });
    DashboardInteractions.generatePublicDashboardUrlClicked({ share: PublicDashboardShareType.EMAIL });
  };

  const disableInputs = !hasWritePermissions || isLoading || isError || hasError;

  return (
    <>
      <Alert
        title=""
        severity="info"
        buttonContent={<span>Learn more</span>}
        onRemove={() => window.open(EMAIL_SHARING_URL, '_blank')}
        bottomSpacing={0}
      >
        Effective immediately, sharing public dashboards by email incurs a cost per active user. Going forward, you’ll
        be prompted for payment whenever you add new users to your dashboard.
      </Alert>
      {!hasWritePermissions && <NoUpsertPermissionsAlert mode="create" />}
      <form onSubmit={handleSubmit(onCreate)}>
        <FieldSet disabled={disableInputs}>
          <div className={styles.checkbox}>
            <Checkbox
              {...register('billAcknowledgment', { required: true })}
              label="I understand that adding users requires payment.*"
            />
          </div>
          <Stack direction="row" gap={1} alignItems="center">
            <Button type="submit" disabled={!isValid}>
              Accept
            </Button>
            <Button variant="secondary" onClick={onCancel} disabled={false}>
              Cancel
            </Button>
            {isLoading && <Spinner />}
          </Stack>
        </FieldSet>
      </form>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  checkbox: css({
    marginBottom: theme.spacing(2),
  }),
});
