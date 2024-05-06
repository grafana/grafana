import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Button, Dropdown, Field, Icon, Menu, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import {
  useReshareAccessToRecipientMutation,
  useDeleteRecipientMutation,
  publicDashboardApi,
} from 'app/features/dashboard/api/publicDashboardApi';
import { PublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { DashboardScene } from '../../../../../scene/DashboardScene';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard.EmailSharingConfiguration;

const RecipientMenu = ({ onDelete, onReshare }: { onDelete: () => void; onReshare: () => void }) => {
  return (
    <Menu>
      <Menu.Item label="Resend invite" onClick={onReshare} />
      <Menu.Item label="Remove access" destructive onClick={onDelete} />
    </Menu>
  );
};

const EmailList = ({
  recipients,
  dashboardUid,
  publicDashboardUid,
}: {
  recipients: PublicDashboard['recipients'];
  dashboardUid: string;
  publicDashboardUid: string;
}) => {
  const styles = useStyles2(getStyles);

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
    <table data-testid={selectors.EmailSharingList} className={styles.table}>
      <tbody>
        {recipients!.map((recipient, idx) => (
          <tr key={recipient.uid} className={styles.listItem}>
            <td className={styles.user}>
              <Stack direction="row" gap={1} alignItems="center">
                <div className={styles.icon}>
                  <Icon name="user" />
                </div>
                <Text>{recipient.recipient} (guest)</Text>
              </Stack>
            </td>
            <td>{isLoading && <Spinner />}</td>
            <td>
              <Dropdown
                overlay={
                  <RecipientMenu
                    onDelete={() => onDeleteEmail(recipient.uid, recipient.recipient)}
                    onReshare={() => onReshare(recipient.uid)}
                  />
                }
              >
                <Button icon="ellipsis-v" variant="secondary" />
              </Dropdown>
              {/*<ButtonGroup>*/}
              {/*  <Button*/}
              {/*    type="button"*/}
              {/*    variant="destructive"*/}
              {/*    fill="text"*/}
              {/*    title={t('public-dashboard.email-sharing.revoke-button-title', 'Revoke')}*/}
              {/*    size="sm"*/}
              {/*    disabled={isLoading}*/}
              {/*    onClick={() => onDeleteEmail(recipient.uid, recipient.recipient)}*/}
              {/*    data-testid={`${selectors.DeleteEmail}-${idx}`}*/}
              {/*  >*/}
              {/*    <Trans i18nKey="public-dashboard.email-sharing.revoke-button">Revoke</Trans>*/}
              {/*  </Button>*/}
              {/*  <Button*/}
              {/*    type="button"*/}
              {/*    variant="primary"*/}
              {/*    fill="text"*/}
              {/*    title={t('public-dashboard.email-sharing.resend-button-title', 'Resend')}*/}
              {/*    size="sm"*/}
              {/*    disabled={isLoading}*/}
              {/*    onClick={() => onReshare(recipient.uid)}*/}
              {/*    data-testid={`${selectors.ReshareLink}-${idx}`}*/}
              {/*  >*/}
              {/*    <Trans i18nKey="public-dashboard.email-sharing.resend-button">Resend</Trans>*/}
              {/*  </Button>*/}
              {/*</ButtonGroup>*/}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const EmailListTab = ({ dashboard }: { dashboard: DashboardScene }) => {
  const styles = useStyles2(getStyles);
  const { data: publicDashboard } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );

  return (
    <Field label="People with access" className={styles.listContainer}>
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

const getStyles = (theme: GrafanaTheme2) => ({
  listContainer: css({
    marginBottom: 0,
  }),
  table: css({
    width: '100%',
  }),
  listItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.75, 1),
    color: theme.colors.border.strong,
  }),
  user: css({
    flex: 1,
  }),
  icon: css({
    border: `${theme.spacing(0.25)} solid ${theme.colors.border.strong}`,
    padding: theme.spacing(0.125, 0.5),
    borderRadius: theme.shape.radius.circle,
    color: theme.colors.border.strong,
  }),
});
