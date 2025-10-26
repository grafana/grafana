import { css } from '@emotion/css';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, Checkbox, FieldSet, Spinner, Stack, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useCreatePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';
import { PublicDashboardShareType } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { AccessControlAction } from 'app/types/accessControl';

import { PublicDashboardAlert } from '../../../../../dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/PublicDashboardAlert';
import { useShareDrawerContext } from '../../../ShareDrawer/ShareDrawerContext';

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareExternally.Creation;

export default function CreatePublicSharing({ hasError }: { hasError: boolean }) {
  const { dashboard, onDismiss } = useShareDrawerContext();
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
      {hasWritePermissions && <PublicDashboardAlert />}
      <form onSubmit={handleSubmit(onCreate)}>
        <FieldSet disabled={disableInputs}>
          <div className={styles.checkbox}>
            <Checkbox
              {...register('publicAcknowledgment', { required: true })}
              label={t(
                'public-dashboard.public-sharing.public-ack',
                'I understand that this entire dashboard will be public.*'
              )}
              data-testid={selectors.willBePublicCheckbox}
            />
          </div>
          <Stack direction="row" gap={1} alignItems="center">
            <Button type="submit" disabled={!isValid} data-testid={selectors.PublicShare.createButton}>
              <Trans i18nKey="public-dashboard.public-sharing.accept-button">Accept</Trans>
            </Button>
            <Button variant="secondary" onClick={onDismiss} data-testid={selectors.PublicShare.cancelButton}>
              <Trans i18nKey="public-dashboard.public-sharing.cancel-button">Cancel</Trans>
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
