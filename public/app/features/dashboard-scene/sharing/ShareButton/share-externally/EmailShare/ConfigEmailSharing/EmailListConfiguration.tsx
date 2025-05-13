import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Dropdown, Field, Icon, IconButton, Menu, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import {
  useReshareAccessToRecipientMutation,
  useDeleteRecipientMutation,
  publicDashboardApi,
} from 'app/features/dashboard/api/publicDashboardApi';
import { PublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard.EmailSharingConfiguration;

const RecipientMenu = ({ onDelete, onReshare }: { onDelete: () => void; onReshare: () => void }) => {
  return (
    <Menu>
      <Menu.Item label={t('public-dashboard.email-sharing.resend-invite-label', 'Resend invite')} onClick={onReshare} />
      <Menu.Item
        label={t('public-dashboard.email-sharing.revoke-access-label', 'Revoke access')}
        destructive
        onClick={onDelete}
      />
    </Menu>
  );
};

const EmailList = ({
  recipients,
  dashboardUid,
  publicDashboard,
}: {
  recipients: PublicDashboard['recipients'];
  dashboardUid: string;
  publicDashboard: PublicDashboard;
}) => {
  const styles = useStyles2(getStyles);

  const [deleteEmail, { isLoading: isDeleteLoading }] = useDeleteRecipientMutation();
  const [reshareAccess, { isLoading: isReshareLoading }] = useReshareAccessToRecipientMutation();

  const isLoading = isDeleteLoading || isReshareLoading;

  const onDeleteEmail = (recipientUid: string, recipientEmail: string) => {
    DashboardInteractions.revokePublicDashboardEmailClicked();
    deleteEmail({ recipientUid, recipientEmail, dashboardUid: dashboardUid, uid: publicDashboard.uid });
  };

  const onReshare = (recipientUid: string) => {
    DashboardInteractions.resendPublicDashboardEmailClicked();
    reshareAccess({ recipientUid, uid: publicDashboard.uid });
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
                <Text>{recipient.recipient}</Text>
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
                <IconButton
                  name="ellipsis-v"
                  aria-label={t('dashboard-scene.email-list.aria-label-emailmenu', 'Toggle email menu')}
                  variant="secondary"
                  size="lg"
                />
              </Dropdown>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const EmailListConfiguration = ({ dashboard }: { dashboard: DashboardScene }) => {
  const styles = useStyles2(getStyles);
  const { data: publicDashboard } = publicDashboardApi.endpoints?.getPublicDashboard.useQueryState(
    dashboard.state.uid!
  );
  return (
    <Field
      label={t('public-dashboard.email-sharing.recipient-list-title', 'People with access')}
      description={t(
        'public-dashboard.email-sharing.recipient-list-description',
        "Only people you've directly invited can access this dashboard"
      )}
      className={styles.listField}
    >
      {!!publicDashboard?.recipients?.length ? (
        <div className={styles.listContainer}>
          <EmailList
            recipients={publicDashboard.recipients}
            dashboardUid={dashboard.state.uid!}
            publicDashboard={publicDashboard}
          />
        </div>
      ) : (
        <></>
      )}
    </Field>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  listField: css({
    marginBottom: 0,
  }),
  listContainer: css({
    maxHeight: '140px',
    overflowY: 'auto',
  }),
  table: css({
    width: '100%',
  }),
  listItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.75, 1),
    color: theme.colors.text.secondary,
  }),
  user: css({
    flex: 1,
  }),
  icon: css({
    border: `${theme.spacing(0.25)} solid ${theme.colors.text.secondary}`,
    padding: theme.spacing(0.125, 0.5),
    borderRadius: theme.shape.radius.circle,
    color: theme.colors.text.secondary,
  }),
});
