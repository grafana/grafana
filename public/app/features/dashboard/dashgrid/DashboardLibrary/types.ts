import { DashboardJson } from 'app/features/manage-dashboards/types';

export interface Link {
  rel: string;
  href: string;
}

export interface Screenshot {
  links: Link[];
}

export interface LogoImage {
  content: string;
  filename: string;
  type: string;
}

export interface Logo {
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
  createdAt?: string; // ISO date string if available
  updatedAt?: string; // ISO date string if available
  publishedAt?: string; // ISO date string if available
  // Author/organization information
  orgId?: number;
  orgName?: string;
  orgSlug?: string;
  userId?: number;
  userName?: string;
}
