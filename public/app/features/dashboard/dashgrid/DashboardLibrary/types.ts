import { DashboardJson } from 'app/features/manage-dashboards/types';

export interface Link {
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

export interface GnetDashboard {
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
