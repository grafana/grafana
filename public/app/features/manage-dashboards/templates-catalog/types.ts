export interface Link {
  rel: string;
  href: string;
}

export interface Screenshot {
  id: number;
  dashboardId: number;
  name: string;
  filename: string;
  mainScreenshot: boolean;
  createdAt: string; // ISO 8601 date string
  updatedAt: string | null; // Can be null
  links: Link[];
}

export interface Logo {
  small: {
    type: string; // MIME type, e.g., "image/png"
    filename: string;
    content: string; // Base64-encoded image
  };
}

export interface Template {
  id: number;
  status: number;
  statusCode: string;
  orgId: number;
  orgSlug: string;
  orgName: string;
  slug: string;
  downloads: number;
  revisionId: number;
  revision: number;
  name: string;
  description: string;
  readme: string;
  collectorType: string | null; // Examples: "nodeExporter"
  collectorConfig: string | null; // Stringified configuration or descriptive text
  collectorPluginList: string | null; // Examples: "conntrack"
  datasource: string; // Example: "Prometheus"
  privacy: string; // Example: "public"
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  isEditor: boolean;
  hasLogo: boolean;
  reviewsCount: number;
  reviewsAvgRating: number;
  links: Link[];
  datasourceSlugs: string[];
  screenshots?: Screenshot[]; // Optional array of screenshots
  logos?: Logo; // Optional logo details
}

export interface GnetAPIResponse {
  items: Template[];
  orderBy: string;
  page: number;
  pageSize: number;
  pages: number;
  total: number;
}

export type SortBy = 'downloads' | 'reviewsAvgRating' | 'name' | 'updatedAt' | 'reviewsCount';
export type SortByDirection = 'asc' | 'desc';
export type SortByOption = { label: string; value: SortBy };

export const SORT_BY_OPTIONS: SortByOption[] = [
  { label: 'Downloads', value: 'downloads' },
  { label: 'Rating', value: 'reviewsAvgRating' },
  { label: 'Name', value: 'name' },
  { label: 'Last Updated', value: 'updatedAt' },
  { label: 'Number of reviews', value: 'reviewsCount' },
];

export const SORT_TO_DIRECTION: Record<SortBy, SortByDirection> = {
  downloads: 'desc',
  reviewsAvgRating: 'desc',
  name: 'asc',
  updatedAt: 'desc',
  reviewsCount: 'desc',
};
