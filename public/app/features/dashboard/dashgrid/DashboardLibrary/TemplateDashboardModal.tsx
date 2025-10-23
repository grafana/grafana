import { css } from '@emotion/css';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, Card, Grid, Modal, useStyles2 } from '@grafana/ui';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

const TEMPLATE_DASHBOARD_COMMUNITY_UIDS = [24279, 24280, 24281, 24282];

interface Link {
  rel: string;
  href: string;
}

interface Screenshot {
  links: Link[];
}

interface LogoImage {
  content: string;
  filename: string;
  type: string;
}

interface Logo {
  small?: LogoImage;
  large?: LogoImage;
}

interface GnetDashboard {
  id: number;
  uid: string;
  name: string;
  description: string;
  downloads: number;
  datasource: string;
  screenshots?: Screenshot[];
  logos?: Logo;
  json?: DashboardJson; // Full dashboard JSON from detail API
}

export const TemplateDashboardModal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isOpen = searchParams.get('templateDashboards') === 'true';

  const styles = useStyles2(getStyles);

  const onClose = () => {
    searchParams.delete('templateDashboards');
    setSearchParams(searchParams);
  };

  const onImportDashboardClick = async (dashboard: GnetDashboard) => {
    console.log('hello');

    const testDataSources = getDataSourceSrv().getList({ type: 'grafana-testdata-datasource' });

    const params = new URLSearchParams({
      datasource: testDataSources[0].uid || '',
      title: dashboard.name,
      pluginId: testDataSources[0].type || '',
      //   title: dashboardTitle,
      gnetId: String(dashboard.id),
      //   path: dashboard.path,
      // tracking event purpose values
      //   sourceEntryPoint: 'datasource_page',
      //   libraryItemId: dashboard.uid,
      //   creationOrigin: 'dashboard_library_datasource_dashboard',
    });

    const templateUrl = `${DASHBOARD_LIBRARY_ROUTES.Template}?${params.toString()}`;
    locationService.push(templateUrl);
  };

  const { value: templateDashboards } = useAsync(async () => {
    const dashboards = await Promise.all(
      TEMPLATE_DASHBOARD_COMMUNITY_UIDS.map(async (uid) => {
        const result = await getBackendSrv().get(`/api/gnet/dashboards/${uid}`, undefined, undefined, {
          showErrorAlert: false,
        });
        return result;
      })
    );

    return dashboards;
  }, []);

  const dashboards = templateDashboards ?? [];
  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onClose}
      title={t('dashboard.template-dashboard-modal.title', 'Create dashboard from template')}
    >
      <Grid
        gap={4}
        columns={{
          xs: 1,
          sm: 2,
          lg: 3,
        }}
      >
        {dashboards?.map((dashboard) => {
          const thumbnail = dashboard.screenshots?.[0]?.links.find((l: Link) => l.rel === 'image')?.href ?? '';
          const thumbnailUrl = thumbnail ? `/api/gnet${thumbnail}` : '';

          return (
            <Card
              key={dashboard.uid}
              onClick={(e) => {
                e.stopPropagation();
                onImportDashboardClick(dashboard);
              }}
              className={styles.card}
              noMargin
            >
              <Card.Heading>{dashboard.name}</Card.Heading>
              <div className={thumbnailUrl ? styles.thumbnailContainer : styles.logoContainer}>
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={dashboard.name}
                    className={thumbnailUrl ? styles.thumbnail : styles.logo}
                    style={{ display: thumbnailUrl ? 'block' : 'none' }}
                  />
                ) : null}
              </div>
              <div title={dashboard.description || ''} className={styles.descriptionWrapper}>
                {dashboard.description && (
                  <Card.Description className={styles.description}>{dashboard.description}</Card.Description>
                )}
              </div>

              <Card.Actions>
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onImportDashboardClick(dashboard);

                    // onUseDashboard(dashboard);
                  }}
                  size="sm"
                >
                  <Trans i18nKey="dashboard.empty.use-template-button">Use this dashboard</Trans>
                </Button>
              </Card.Actions>
            </Card>
          );
        })}
      </Grid>
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    resultsContainer: css({
      width: '100%',
      minHeight: '600px',
      position: 'relative',
    }),
    loadingOverlay: css({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background.canvas,
      zIndex: 1,
    }),
    card: css({
      gridTemplateAreas: `
          "Heading"
          "Thumbnail"
          "Description"
          "Actions"`,
      gridTemplateRows: 'auto 200px auto auto',
      height: 'auto',
    }),
    thumbnailContainer: css({
      gridArea: 'Thumbnail',

      overflow: 'hidden',
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.secondary,
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '200px',
    }),
    thumbnail: css({
      width: '285px',

      objectFit: 'contain',
    }),
    logoContainer: css({
      gridArea: 'Thumbnail',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.secondary,
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
    }),
    logo: css({
      maxWidth: '100px',
      maxHeight: '100px',
      objectFit: 'contain',
    }),
    descriptionWrapper: css({
      gridArea: 'Description',
      cursor: 'help',
    }),
    description: css({
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      margin: 0,
    }),
    pagination: css({
      marginTop: theme.spacing(2),
      alignItems: 'center',
    }),
  };
}
