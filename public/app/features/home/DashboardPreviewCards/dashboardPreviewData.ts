import cloudwatchPreview from 'img/home-dashboard-previews/cloudwatch.png';
import lokiPreview from 'img/home-dashboard-previews/loki.png';
import prometheusPreview from 'img/home-dashboard-previews/prometheus.png';

export interface DashboardPreviewCardData {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  href: string;
}

export const dashboardPreviewCards: DashboardPreviewCardData[] = [
  {
    id: 'cloudwatch',
    title: 'CloudWatch Dashboards',
    description: 'Monitor your AWS infrastructure with CloudWatch metrics',
    imagePath: cloudwatchPreview,
    href: '/d/home-cw-overview/cloudwatch-overview',
  },
  {
    id: 'prometheus',
    title: 'Prometheus Dashboards',
    description: 'Visualize Prometheus metrics and alerts',
    imagePath: prometheusPreview,
    href: '/d/home-prom-overview/prometheus-overview',
  },
  {
    id: 'loki',
    title: 'Loki Dashboards',
    description: 'Explore and analyze logs with Loki',
    imagePath: lokiPreview,
    href: '/d/home-loki-overview/loki-logs-overview',
  },
];
