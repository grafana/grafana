import { PluginExtensionAddedUrlRecognizerConfig, UrlMetadata } from '@grafana/data';
import { t } from '@grafana/i18n';

export function getDefaultUrlRecognizers(): PluginExtensionAddedUrlRecognizerConfig[] {
  return [
    {
      title: t('nav.dashboards.title', 'Dashboards'),
      description: t('url-recognizer.dashboard.description', 'Recognizes Grafana dashboard URLs'),
      recognizer: async (url: string): Promise<UrlMetadata | null> => {
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;

          // Match dashboard URLs like /d/uid/dashboard-name
          const dashboardMatch = pathname.match(/^\/d\/([^/]+)(?:\/([^/]+))?/);
          if (dashboardMatch) {
            const uid = dashboardMatch[1];
            const name = dashboardMatch[2] ? decodeURIComponent(dashboardMatch[2]) : 'Dashboard';

            return {
              id: uid,
              title: name.replace(/-/g, ' '),
              description: `Grafana Dashboard: ${name}`,
              type: 'dashboard',
              uid,
            };
          }
        } catch (error) {
          // Invalid URL, return null
        }
        return null;
      },
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['dashboard'] },
          uid: { type: 'string' },
        },
        required: ['id', 'title', 'type', 'uid'],
      },
    },
    {
      title: t('nav.explore.title', 'Explore'),
      description: t('url-recognizer.explore.description', 'Recognizes Grafana Explore URLs'),
      recognizer: async (url: string): Promise<UrlMetadata | null> => {
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;

          // Match explore URLs
          if (pathname.startsWith('/explore')) {
            const datasourceParam = urlObj.searchParams.get('left') || urlObj.searchParams.get('right');

            let datasourceName = 'Unknown';
            if (datasourceParam) {
              try {
                const parsedLeft = JSON.parse(datasourceParam);
                datasourceName = parsedLeft.datasource || 'Unknown';
              } catch {
                datasourceName = 'Unknown';
              }
            }

            return {
              id: 'explore',
              title: t('nav.explore.title', 'Explore'),
              description: `Explore view with ${datasourceName} datasource`,
              type: 'explore',
              datasource: datasourceName,
            };
          }
        } catch (error) {
          // Invalid URL, return null
        }
        return null;
      },
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['explore'] },
          datasource: { type: 'string' },
        },
        required: ['id', 'title', 'type'],
      },
    },
    {
      title: t('nav.alerting-list.title', 'Alert rules'),
      description: t('url-recognizer.alert.description', 'Recognizes Grafana Alert Rule URLs'),
      recognizer: async (url: string): Promise<UrlMetadata | null> => {
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;

          // Match alert rule URLs like /alerting/rule/{uid}/view
          const alertMatch = pathname.match(/^\/alerting\/rule\/([^/]+)/);
          if (alertMatch) {
            const uid = alertMatch[1];
            const viewMode = pathname.includes('/view') ? 'view' : 'edit';

            return {
              id: uid,
              title: t('nav.alerting-list.title', 'Alert rules'),
              description: `Alert rule (${viewMode} mode)`,
              type: 'alert',
              uid,
              mode: viewMode,
            };
          }

          // Match alerting list page
          if (pathname.startsWith('/alerting/list')) {
            return {
              id: 'alerting-list',
              title: t('nav.alerting-list.title', 'Alert rules'),
              description: t('nav.alerting-list.title', 'Alert rules'),
              type: 'alert-list',
            };
          }
        } catch (error) {
          // Invalid URL, return null
        }
        return null;
      },
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['alert', 'alert-list'] },
          uid: { type: 'string' },
          mode: { type: 'string', enum: ['view', 'edit'] },
        },
        required: ['id', 'title', 'type'],
      },
    },
  ];
}
