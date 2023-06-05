import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Button, LoadingPlaceholder, Modal, ModalsController, useStyles2 } from '@grafana/ui/src';
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
    <Modal className={styles.modal} isOpen title="Public dashboards" onDismiss={onDismiss}>
      {isLoading ? (
        <div className={styles.loading}>
          <LoadingPlaceholder text="Loading..." />
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
                Public dashboard URL
              </a>
              <span className={styles.urlsDivider}>•</span>
              <a
                className={cx('external-link', styles.url)}
                href={generatePublicDashboardConfigUrl(dash.dashboardUid)}
                onClick={onDismiss}
              >
                Public dashboard settings
              </a>
            </div>
            <hr className={styles.divider} />
          </div>
        ))
      )}
    </Modal>
  );
};

export const DashboardsListModalButton = ({ email }: { email: string }) => (
  <ModalsController>
    {({ showModal, hideModal }) => (
      <Button
        variant="secondary"
        size="sm"
        icon="question-circle"
        title="Open dashboards list"
        aria-label="Open dashboards list"
        onClick={() => showModal(DashboardsListModal, { email, onDismiss: hideModal })}
      />
    )}
  </ModalsController>
);

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
