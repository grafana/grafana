import { PluginExtensionAddedUrlRecognizerConfig, UrlMetadata } from '@grafana/data';

export function getDefaultUrlRecognizers(): PluginExtensionAddedUrlRecognizerConfig[] {
  return [
    {
      title: 'Dashboard',
      description: 'Recognizes Grafana dashboard URLs',
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
      title: 'Explore',
      description: 'Recognizes Grafana Explore URLs',
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
              title: 'Explore',
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
      title: 'Alert Rule',
      description: 'Recognizes Grafana Alert Rule URLs',
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
              title: 'Alert Rule',
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
              title: 'Alert Rules',
              description: 'Alert rules list',
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
