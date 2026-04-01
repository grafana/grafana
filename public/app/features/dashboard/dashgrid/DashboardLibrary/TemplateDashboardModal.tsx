import { css } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config, getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Box, Grid, Modal, Tab, TabsBar, Text, useStyles2 } from '@grafana/ui';

import { listOrgTemplates, type OrgDashboardTemplate } from '../../../dashboard-scene/saving/orgTemplateApi';
import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { DashboardCard } from './DashboardCard';
import { NewTemplateDashboardInteractions } from './analytics/main';
import {
  CONTENT_KINDS,
  DISCOVERY_METHODS,
  EVENT_LOCATIONS,
  type SourceEntryPoint,
  TemplateDashboardSourceEntryPoint,
} from './constants';
import { TemplateDashboardInteractions } from './interactions';
import { type GnetDashboard, type GnetDashboardsResponse, type Link } from './types';
import { getTemplateDashboardUrl } from './utils/templateDashboardHelpers';
const SourceEntryPointMap: Record<string, SourceEntryPoint> = {
  quickAdd: TemplateDashboardSourceEntryPoint.QUICK_ADD_BUTTON,
  commandPalette: TemplateDashboardSourceEntryPoint.COMMAND_PALETTE,
  createNewButton: TemplateDashboardSourceEntryPoint.BROWSE_DASHBOARDS_PAGE,
};

type TemplateTab = 'grafana' | 'custom';

export const TemplateDashboardModal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isOpen = searchParams.get('templateDashboards') === 'true';
  const entryPoint = searchParams.get('source') || '';
  const showOrgTemplates = Boolean(config.featureToggles.orgDashboardTemplates);
  const [activeTab, setActiveTab] = useState<TemplateTab>(showOrgTemplates ? 'custom' : 'grafana');
  const isDashboardTemplatesAssistantButtonEnabled = useBooleanFlagValue('dashboardTemplatesAssistantButton', false);
  const isDashboardTemplatesAssistantToolEnabled = useBooleanFlagValue(
    'assistant.frontend.tools.dashboardTemplates',
    false
  );
  const isAnalyticsFrameworkEnabled = useBooleanFlagValue('analyticsFramework', true);

  const testDataSource = getDataSourceSrv().getList({ type: 'grafana-testdata-datasource' })[0];

  const styles = useStyles2(getStyles);

  const onClose = () => {
    searchParams.delete('templateDashboards');
    setSearchParams(searchParams);
  };

  const onPreviewDashboardClick = async (dashboard: GnetDashboard, customizeWithAssistant = false) => {
    const sourceEntryPoint = SourceEntryPointMap[entryPoint] || 'unknown';
    isAnalyticsFrameworkEnabled
      ? NewTemplateDashboardInteractions.itemClicked({
          contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
          datasourceTypes: [String(testDataSource?.type)],
          libraryItemId: String(dashboard.id),
          libraryItemTitle: dashboard.name,
          sourceEntryPoint,
          eventLocation: EVENT_LOCATIONS.BROWSE_DASHBOARDS_PAGE,
          discoveryMethod: DISCOVERY_METHODS.BROWSE,
          action: customizeWithAssistant ? 'assistant' : 'view_template',
        })
      : TemplateDashboardInteractions.itemClicked({
          contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
          datasourceTypes: [String(testDataSource?.type)],
          libraryItemId: String(dashboard.id),
          libraryItemTitle: dashboard.name,
          sourceEntryPoint,
          eventLocation: EVENT_LOCATIONS.BROWSE_DASHBOARDS_PAGE,
          discoveryMethod: DISCOVERY_METHODS.BROWSE,
          action: customizeWithAssistant ? 'assistant' : 'view_template',
        });

    const templateUrl = getTemplateDashboardUrl(
      dashboard,
      sourceEntryPoint,
      customizeWithAssistant ? TemplateDashboardSourceEntryPoint.ASSISTANT_BUTTON : undefined
    );
    locationService.push(templateUrl);
  };

  const { value: dashboards = [], loading } = useAsync(async () => {
    if (!isOpen) {
      return [];
    }

    try {
      const response = await getBackendSrv().get<GnetDashboardsResponse>(
        `/api/gnet/dashboards?orgSlug=raintank&categorySlug=templates&includeScreenshots=true`,
        undefined,
        undefined,
        {
          showErrorAlert: false,
        }
      );

      return response.items;
    } catch (error) {
      console.error('Error loading template dashboards ', error);
      return [];
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !loading && dashboards.length > 0) {
      isAnalyticsFrameworkEnabled
        ? NewTemplateDashboardInteractions.loaded({
            numberOfItems: dashboards.length,
            contentKinds: [CONTENT_KINDS.TEMPLATE_DASHBOARD],
            datasourceTypes: [String(testDataSource?.type)],
            sourceEntryPoint: SourceEntryPointMap[entryPoint] || 'unknown',
            eventLocation: EVENT_LOCATIONS.BROWSE_DASHBOARDS_PAGE,
          })
        : TemplateDashboardInteractions.loaded({
            numberOfItems: dashboards.length,
            contentKinds: [CONTENT_KINDS.TEMPLATE_DASHBOARD],
            datasourceTypes: [String(testDataSource?.type)],
            sourceEntryPoint: SourceEntryPointMap[entryPoint] || 'unknown',
            eventLocation: EVENT_LOCATIONS.BROWSE_DASHBOARDS_PAGE,
          });
    }
  }, [isOpen, dashboards, entryPoint, testDataSource?.type, loading, isAnalyticsFrameworkEnabled]);

  const { value: orgTemplates = [], loading: orgTemplatesLoading } = useAsync(async () => {
    if (!isOpen || !showOrgTemplates) {
      return [];
    }
    try {
      const namespace = 'default';
      const response = await listOrgTemplates(namespace);
      return response.items;
    } catch (error) {
      console.error('Error loading org templates', error);
      return [];
    }
  }, [isOpen, showOrgTemplates]);

  const onUseOrgTemplate = (template: OrgDashboardTemplate) => {
    onClose();
    const params = new URLSearchParams({
      orgTemplateUid: template.metadata.name,
    });
    locationService.push(`${DASHBOARD_LIBRARY_ROUTES.Template}?${params.toString()}`);
  };

  if (!testDataSource || (dashboards.length === 0 && !loading && orgTemplates.length === 0 && !orgTemplatesLoading)) {
    return null;
  }

  const renderGrafanaTemplates = () => (
    <Grid
      gap={4}
      columns={{
        xs: 1,
        sm: 2,
        lg: 3,
      }}
    >
      {loading
        ? Array.from({ length: 4 }).map((_, index) => <DashboardCard.Skeleton key={index} />)
        : dashboards?.map((dashboard) => {
            const thumbnail = dashboard.screenshots?.[0]?.links.find((l: Link) => l.rel === 'image')?.href ?? '';
            const thumbnailUrl = thumbnail ? `/api/gnet${thumbnail}` : '';

            return (
              <DashboardCard
                key={dashboard.id}
                title={dashboard.name}
                imageUrl={thumbnailUrl}
                onClick={(customizeWithAssistant?: boolean) =>
                  onPreviewDashboardClick(dashboard, customizeWithAssistant)
                }
                onClose={onClose}
                dashboard={dashboard}
                kind="template_dashboard"
                showAssistantButton={
                  isDashboardTemplatesAssistantButtonEnabled && isDashboardTemplatesAssistantToolEnabled
                }
              />
            );
          })}
    </Grid>
  );

  const renderOrgTemplates = () => (
    <Grid
      gap={4}
      columns={{
        xs: 1,
        sm: 2,
        lg: 3,
      }}
    >
      {orgTemplatesLoading
        ? Array.from({ length: 4 }).map((_, index) => <DashboardCard.Skeleton key={index} />)
        : orgTemplates.map((template: OrgDashboardTemplate, index: number) => {
            // Create a GnetDashboard-compatible object for the card
            const dashboardCompat: GnetDashboard = {
              id: index,
              name: template.spec.title,
              description: template.spec.description,
              slug: template.metadata.name,
              downloads: 0,
              datasource: '',
              screenshots: [],
            };

            return (
              <DashboardCard
                key={template.metadata.name}
                title={template.spec.title}
                onClick={() => onUseOrgTemplate(template)}
                onClose={onClose}
                dashboard={dashboardCompat}
                kind="template_dashboard"
                showAssistantButton={false}
              />
            );
          })}
      {!orgTemplatesLoading && orgTemplates.length === 0 && (
        <Text color="secondary">
          <Trans i18nKey="dashboard-library.template-dashboard-modal.no-org-templates">
            No custom templates yet. Save a dashboard as a template to get started.
          </Trans>
        </Text>
      )}
    </Grid>
  );

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onClose}
      className={styles.modal}
      title={t('dashboard-library.template-dashboard-modal.title', 'Start a dashboard from a template')}
      contentClassName={styles.modalContent}
    >
      <div className={styles.stickyHeader}>
        <Text element="p">
          <Trans i18nKey="dashboard-library.template-dashboard-modal.description">
            Get started with Grafana templates using sample data. Connect your data to power them with real metrics.
          </Trans>
        </Text>
        {showOrgTemplates && (
          <TabsBar>
            <Tab
              label={t('dashboard-library.template-dashboard-modal.tab-custom', 'Custom templates')}
              active={activeTab === 'custom'}
              onChangeTab={() => setActiveTab('custom')}
            />
            <Tab
              label={t('dashboard-library.template-dashboard-modal.tab-grafana', 'Grafana-provisioned')}
              active={activeTab === 'grafana'}
              onChangeTab={() => setActiveTab('grafana')}
            />
          </TabsBar>
        )}
      </div>
      <Box direction="column" gap={4} display="flex">
        {showOrgTemplates && activeTab === 'custom' ? renderOrgTemplates() : renderGrafanaTemplates()}
      </Box>
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '1200px',
    }),
    stickyHeader: css({
      position: 'sticky',
      top: 0,
      zIndex: 2,
      backgroundColor: theme.colors.background.primary,
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(2),
    }),
    modalContent: css({
      paddingTop: 0,
      height: '100%',
    }),
  };
}
