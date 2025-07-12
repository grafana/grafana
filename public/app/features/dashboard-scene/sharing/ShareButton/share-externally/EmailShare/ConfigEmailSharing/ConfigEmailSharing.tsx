import { useForm } from 'react-hook-form';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, Divider, Field, FieldSet, Icon, Input, Stack, Tooltip } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { publicDashboardApi, useAddRecipientMutation } from 'app/features/dashboard/api/publicDashboardApi';
import { validEmailRegex } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { AccessControlAction } from 'app/types/accessControl';

import { useShareDrawerContext } from '../../../../ShareDrawer/ShareDrawerContext';
import ShareConfiguration from '../../ShareConfiguration';

import { EmailListConfiguration } from './EmailListConfiguration';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard.EmailSharingConfiguration;

type EmailSharingForm = { email: string };

export const ConfigEmailSharing = () => {
  const { dashboard } = useShareDrawerContext();

  const { data: publicDashboard, isError } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );
  const [addEmail, { isLoading: isAddEmailLoading }] = useAddRecipientMutation();

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<EmailSharingForm>({
    defaultValues: {
      email: '',
    },
    mode: 'onSubmit',
  });

  const onSubmit = async (data: EmailSharingForm) => {
    DashboardInteractions.publicDashboardEmailInviteClicked();
    await addEmail({ recipient: data.email, uid: publicDashboard!.uid, dashboardUid: dashboard.state.uid! }).unwrap();
    reset({ email: '' });
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldSet disabled={!hasWritePermissions || isError}>
          <Field
            label={
              <Stack gap={1} alignItems="center">
                <Trans i18nKey="public-dashboard.email-sharing.recipient-invitation-button">Invite</Trans>
                <Tooltip
                  placement="right"
                  content={t(
                    'public-dashboard.email-sharing.recipient-invitation-tooltip',
                    'This dashboard contains sensitive data. By using this feature you will be sharing with external people.'
                  )}
                >
                  <Icon name="info-circle" size="sm" />
                </Tooltip>
              </Stack>
            }
            description={t(
              'public-dashboard.email-sharing.recipient-invitation-description',
              'Invite someone by email'
            )}
            error={errors.email?.message}
            invalid={!!errors.email?.message}
          >
            <Stack direction="row">
              <Input
                placeholder={t('public-dashboard.email-sharing.recipient-email-placeholder', 'Email')}
                autoCapitalize="none"
                loading={isAddEmailLoading}
                {...register('email', {
                  required: t('public-dashboard.email-sharing.recipient-required-email-text', 'Email is required'),
                  pattern: {
                    value: validEmailRegex,
                    message: t('public-dashboard.email-sharing.recipient-invalid-email-text', 'Invalid email'),
                  },
                })}
                data-testid={selectors.EmailSharingInput}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={isAddEmailLoading || !isValid}
                data-testid={selectors.EmailSharingInviteButton}
              >
                <Trans i18nKey="public-dashboard.email-sharing.recipient-invitation-button">Invite</Trans>
              </Button>
            </Stack>
          </Field>
        </FieldSet>
      </form>
      <EmailListConfiguration dashboard={dashboard} />
      <Divider />
      <ShareConfiguration />
    </div>
  );
};
