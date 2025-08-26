import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useMedia } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import {
  Card,
  EmptyState,
  LinkButton,
  Pagination,
  Spinner,
  Switch,
  TextLink,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import {
  useListPublicDashboardsQuery,
  useUpdatePublicDashboardMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import {
  generatePublicDashboardConfigUrl,
  generatePublicDashboardUrl,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { AccessControlAction } from 'app/types/accessControl';

import { PublicDashboardListResponse } from '../../types';

import { DeletePublicDashboardButton } from './DeletePublicDashboardButton';

const PublicDashboardCard = ({ pd }: { pd: PublicDashboardListResponse }) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);

  const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();

  const selectors = e2eSelectors.pages.PublicDashboards;
  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  const onTogglePause = (pd: PublicDashboardListResponse, isPaused: boolean) => {
    const req = {
      dashboard: { uid: pd.dashboardUid },
      payload: {
        uid: pd.uid,
        isEnabled: !isPaused,
      },
    };

    update(req);
  };

  const CardActions = useMemo(() => (isMobile ? Card.Actions : Card.SecondaryActions), [isMobile]);

  const isNewSharingComponentEnabled = config.featureToggles.newDashboardSharingComponent;
  const translatedPauseSharingText = isNewSharingComponentEnabled
    ? t('shared-dashboard-list.toggle.pause-sharing-toggle-text', 'Pause access')
    : t('public-dashboard-list.toggle.pause-sharing-toggle-text', 'Pause sharing');

  return (
    <Card className={styles.card} href={`/d/${pd.dashboardUid}`}>
      <Card.Heading className={styles.heading}>
        <span>{pd.title}</span>
      </Card.Heading>
      <CardActions className={styles.actions}>
        <div className={styles.pauseSwitch}>
          <Switch
            value={!pd.isEnabled}
            label={translatedPauseSharingText}
            disabled={isUpdateLoading}
            onChange={(e) => {
              reportInteraction('grafana_dashboards_public_enable_clicked', {
                action: e.currentTarget.checked ? 'disable' : 'enable',
              });
              onTogglePause(pd, e.currentTarget.checked);
            }}
            data-testid={selectors.ListItem.pauseSwitch}
          />
          <span>{translatedPauseSharingText}</span>
        </div>
        <LinkButton
          fill="text"
          icon="external-link-alt"
          variant="secondary"
          target="_blank"
          color={theme.colors.warning.text}
          href={generatePublicDashboardUrl(pd.accessToken)}
          key="public-dashboard-url"
          tooltip={
            isNewSharingComponentEnabled
              ? t('shared-dashboard-list.button.view-button-tooltip', 'View shared dashboard')
              : t('public-dashboard-list.button.view-button-tooltip', 'View public dashboard')
          }
          data-testid={selectors.ListItem.linkButton}
        />
        <LinkButton
          fill="text"
          icon="cog"
          variant="secondary"
          color={theme.colors.warning.text}
          href={generatePublicDashboardConfigUrl(pd.dashboardUid, pd.slug)}
          key="public-dashboard-config-url"
          tooltip={
            isNewSharingComponentEnabled
              ? t('shared-dashboard-list.button.config-button-tooltip', 'Configure shared dashboard')
              : t('public-dashboard-list.button.config-button-tooltip', 'Configure public dashboard')
          }
          data-testid={selectors.ListItem.configButton}
        />
        {hasWritePermissions && (
          <DeletePublicDashboardButton
            fill="text"
            icon="trash-alt"
            variant="secondary"
            publicDashboard={pd}
            tooltip={
              isNewSharingComponentEnabled
                ? t('shared-dashboard-list.button.revoke-button-tooltip', 'Revoke access')
                : t('public-dashboard-list.button.revoke-button-tooltip', 'Revoke public dashboard URL')
            }
            loader={<Spinner />}
            data-testid={selectors.ListItem.trashcanButton}
          />
        )}
      </CardActions>
    </Card>
  );
};

export const PublicDashboardListTable = () => {
  const [page, setPage] = useState(1);

  const styles = useStyles2(getStyles);
  const { data: paginatedPublicDashboards, isLoading, isError } = useListPublicDashboardsQuery(page);

  return (
    <Page navId="dashboards/public">
      <Page.Contents isLoading={isLoading}>
        {!isLoading && !isError && !!paginatedPublicDashboards && (
          <div>
            {paginatedPublicDashboards.publicDashboards.length === 0 ? (
              config.featureToggles.newDashboardSharingComponent ? (
                <EmptyState
                  variant="call-to-action"
                  message={t(
                    'shared-dashboard-list.empty-state.message',
                    "You haven't created any shared dashboards yet"
                  )}
                >
                  <Trans i18nKey="shared-dashboard-list.empty-state.more-info">
                    Create a shared dashboard from any existing dashboard through the <b>Share</b> modal.{' '}
                    <TextLink
                      external
                      href="https://grafana.com/docs/grafana/latest/dashboards/share-dashboards-panels/shared-dashboards"
                    >
                      Learn more
                    </TextLink>
                  </Trans>
                </EmptyState>
              ) : (
                <EmptyState
                  variant="call-to-action"
                  message={t(
                    'public-dashboard-list.empty-state.message',
                    "You haven't created any public dashboards yet"
                  )}
                >
                  <Trans i18nKey="public-dashboard-list.empty-state.more-info">
                    Create a public dashboard from any existing dashboard through the <b>Share</b> modal.{' '}
                    <TextLink
                      external
                      href="https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/#make-a-dashboard-public"
                    >
                      Learn more
                    </TextLink>
                  </Trans>
                </EmptyState>
              )
            ) : (
              <>
                <ul className={styles.list}>
                  {paginatedPublicDashboards.publicDashboards.map((pd: PublicDashboardListResponse) => (
                    <li key={pd.uid}>
                      <PublicDashboardCard pd={pd} />
                    </li>
                  ))}
                </ul>
                <Pagination
                  onNavigate={setPage}
                  currentPage={paginatedPublicDashboards.page}
                  numberOfPages={paginatedPublicDashboards.totalPages}
                  hideWhenSinglePage
                />
              </>
            )}
          </div>
        )}
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    listStyleType: 'none',
    marginBottom: theme.spacing(2),
  }),
  card: css({
    [theme.breakpoints.up('sm')]: {
      display: 'flex',
    },
  }),
  heading: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flex: 1,
  }),
  orphanedTitle: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  actions: css({
    display: 'flex',
    alignItems: 'center',
    position: 'relative',

    gap: theme.spacing(0.5),
    [theme.breakpoints.up('sm')]: {
      gap: theme.spacing(1),
    },
  }),
  pauseSwitch: css({
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    fontSize: theme.typography.bodySmall.fontSize,
    marginBottom: 0,
    flex: 1,

    [theme.breakpoints.up('sm')]: {
      paddingRight: theme.spacing(2),
    },
  }),
});
