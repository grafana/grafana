import React from 'react';
import { useForm } from 'react-hook-form';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Button, Field, FieldSet, Spinner, Stack } from '@grafana/ui';
import { Input } from '@grafana/ui/src/components/Input/Input';
import { Trans, t } from '@grafana/ui/src/utils/i18n';

import { contextSrv } from '../../../../../../../core/core';
import { AccessControlAction } from '../../../../../../../types/accessControl';
import {
  useAddRecipientMutation,
  useGetPublicDashboardQuery,
} from '../../../../../../dashboard/api/publicDashboardApi';
import { validEmailRegex } from '../../../../../../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from '../../../../../scene/DashboardScene';
import { DashboardInteractions } from '../../../../../utils/interactions';

import { EmailShareTabs } from './EmailShareTabs';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard.EmailSharingConfiguration;

type EmailSharingForm = { email: string };

export const ConfigEmailSharing = ({ dashboard }: { dashboard: DashboardScene }) => {
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

  const { data: publicDashboard } = useGetPublicDashboardQuery(dashboard.state.uid!);
  const [addEmail, { isLoading: isAddEmailLoading }] = useAddRecipientMutation();
  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  const onSubmit = async (data: EmailSharingForm) => {
    DashboardInteractions.publicDashboardEmailInviteClicked();
    await addEmail({ recipient: data.email, uid: publicDashboard!.uid, dashboardUid: dashboard.state.uid! }).unwrap();
    reset({ email: '' });
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldSet disabled={!hasWritePermissions}>
          <Field
            label={t('public-dashboard.email-sharing.invite-field-label', 'Invite')}
            description={t('public-dashboard.email-sharing.invite-field-desc', 'Invite people by email')}
            error={errors.email?.message}
            invalid={!!errors.email?.message || undefined}
          >
            <Stack direction="row">
              <Input
                placeholder="Email"
                autoCapitalize="none"
                {...register('email', {
                  required: t('public-dashboard.email-sharing.input-required-email-text', 'Email is required'),
                  pattern: {
                    value: validEmailRegex,
                    message: t('public-dashboard.email-sharing.input-invalid-email-text', 'Invalid email'),
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
                <Trans i18nKey="public-dashboard.email-sharing.invite-button">Invite</Trans>
                {isAddEmailLoading && <Spinner />}
              </Button>
            </Stack>
          </Field>
        </FieldSet>
      </form>
      <EmailShareTabs dashboard={dashboard} />
    </div>
  );
};
