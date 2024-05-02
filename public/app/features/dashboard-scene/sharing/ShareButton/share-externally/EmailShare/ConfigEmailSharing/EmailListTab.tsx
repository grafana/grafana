import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Button, ButtonGroup, Field, useStyles2 } from '@grafana/ui';
import { t } from '@grafana/ui/src/utils/i18n';
import { Trans } from 'app/core/internationalization';
import {
  useGetPublicDashboardQuery,
  useReshareAccessToRecipientMutation,
  useDeleteRecipientMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import { PublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { DashboardScene } from '../../../../../scene/DashboardScene';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard.EmailSharingConfiguration;

const EmailList = ({
  recipients,
  dashboardUid,
  publicDashboardUid,
}: {
  recipients: PublicDashboard['recipients'];
  dashboardUid: string;
  publicDashboardUid: string;
}) => {
  // const styles = useStyles2(getStyles);

  const [deleteEmail, { isLoading: isDeleteLoading }] = useDeleteRecipientMutation();
  const [reshareAccess, { isLoading: isReshareLoading }] = useReshareAccessToRecipientMutation();

  const isLoading = isDeleteLoading || isReshareLoading;

  const onDeleteEmail = (recipientUid: string, recipientEmail: string) => {
    DashboardInteractions.revokePublicDashboardEmailClicked();
    deleteEmail({ recipientUid, recipientEmail, dashboardUid: dashboardUid, uid: publicDashboardUid });
  };

  const onReshare = (recipientUid: string) => {
    DashboardInteractions.resendPublicDashboardEmailClicked();
    reshareAccess({ recipientUid, uid: publicDashboardUid });
  };

  return (
    <table data-testid={selectors.EmailSharingList}>
      <tbody>
        {recipients!.map((recipient, idx) => (
          <tr key={recipient.uid}>
            <td>{recipient.recipient}</td>
            <td>
              <ButtonGroup>
                <Button
                  type="button"
                  variant="destructive"
                  fill="text"
                  title={t('public-dashboard.email-sharing.revoke-button-title', 'Revoke')}
                  size="sm"
                  disabled={isLoading}
                  onClick={() => onDeleteEmail(recipient.uid, recipient.recipient)}
                  data-testid={`${selectors.DeleteEmail}-${idx}`}
                >
                  <Trans i18nKey="public-dashboard.email-sharing.revoke-button">Revoke</Trans>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  fill="text"
                  title={t('public-dashboard.email-sharing.resend-button-title', 'Resend')}
                  size="sm"
                  disabled={isLoading}
                  onClick={() => onReshare(recipient.uid)}
                  data-testid={`${selectors.ReshareLink}-${idx}`}
                >
                  <Trans i18nKey="public-dashboard.email-sharing.resend-button">Resend</Trans>
                </Button>
              </ButtonGroup>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const EmailListTab = ({ dashboard }: { dashboard: DashboardScene }) => {
  const { data: publicDashboard } = useGetPublicDashboardQuery(dashboard.state.uid!);

  return (
    <Field label="People with access">
      {!!publicDashboard?.recipients?.length ? (
        <EmailList
          recipients={publicDashboard.recipients}
          dashboardUid={dashboard.state.uid!}
          publicDashboardUid={publicDashboard.uid}
        />
      ) : (
        <></>
      )}
    </Field>
  );
};
