import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Button, LoadingPlaceholder, Modal, ModalsController, useStyles2 } from '@grafana/ui/src';
import { Trans, t } from 'app/core/internationalization';
import {
  generatePublicDashboardConfigUrl,
  generatePublicDashboardUrl,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

import { useGetActiveUserDashboardsQuery } from '../../dashboard/api/publicDashboardApi';

const selectors = e2eSelectors.pages.UserListPage.UsersListPublicDashboardsPage.DashboardsListModal;
export const DashboardsListModal = ({ email, onDismiss }: { email: string; onDismiss: () => void }) => {
  const styles = useStyles2(getStyles);

  const { data: dashboards, isLoading } = useGetActiveUserDashboardsQuery(email);

  return (
    <Modal
      className={styles.modal}
      isOpen
      title={t('public-dashboard-users-access-list.modal.dashboard-modal-title', 'Public dashboards')}
      onDismiss={onDismiss}
    >
      {isLoading ? (
        <div className={styles.loading}>
          <LoadingPlaceholder
            text={t('public-dashboard-users-access-list.dashboard-modal.loading-text', 'Loading...')}
          />
        </div>
      ) : (
        dashboards?.map((dash) => (
          <div key={dash.dashboardUid} className={styles.listItem} data-testid={selectors.listItem(dash.dashboardUid)}>
            <p className={styles.dashboardTitle}>{dash.dashboardTitle}</p>
            <div className={styles.urlsContainer}>
              <a
                rel="noreferrer"
                target="_blank"
                className={cx('external-link', styles.url)}
                href={generatePublicDashboardUrl(dash.publicDashboardAccessToken)}
                onClick={onDismiss}
              >
                <Trans i18nKey="public-dashboard-users-access-list.dashboard-modal.public-dashboard-link">
                  Public dashboard URL
                </Trans>
              </a>
              <span className={styles.urlsDivider}>•</span>
              <a
                className={cx('external-link', styles.url)}
                href={generatePublicDashboardConfigUrl(dash.dashboardUid, dash.slug)}
                onClick={onDismiss}
              >
                <Trans i18nKey="public-dashboard-users-access-list.dashboard-modal.public-dashboard-setting">
                  Public dashboard settings
                </Trans>
              </a>
            </div>
            <hr className={styles.divider} />
          </div>
        ))
      )}
    </Modal>
  );
};

export const DashboardsListModalButton = ({ email }: { email: string }) => {
  const translatedDashboardListModalButtonText = t(
    'public-dashboard-users-access-list.dashboard-modal.open-dashboard-list-text',
    'Open dashboards list'
  );
  return (
    <ModalsController>
      {({ showModal, hideModal }) => (
        <Button
          variant="secondary"
          size="sm"
          icon="question-circle"
          title={translatedDashboardListModalButtonText}
          aria-label={translatedDashboardListModalButtonText}
          onClick={() => showModal(DashboardsListModal, { email, onDismiss: hideModal })}
        />
      )}
    </ModalsController>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: 590px;
  `,
  loading: css`
    display: flex;
    justify-content: center;
  `,
  listItem: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(0.5)};
  `,
  divider: css`
    margin: ${theme.spacing(1.5, 0)};
    color: ${theme.colors.text.secondary};
  `,
  urlsContainer: css`
    display: flex;
    gap: ${theme.spacing(0.5)};

    ${theme.breakpoints.down('sm')} {
      flex-direction: column;
    }
  `,
  urlsDivider: css`
    color: ${theme.colors.text.secondary};
    ${theme.breakpoints.down('sm')} {
      display: none;
    }
  `,
  dashboardTitle: css`
    font-size: ${theme.typography.body.fontSize};
    font-weight: ${theme.typography.fontWeightBold};
    margin-bottom: 0;
  `,
  url: css`
    font-size: ${theme.typography.body.fontSize};
  `,
});
