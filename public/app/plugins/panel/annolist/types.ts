export interface AnnoOptions {
  limit: number;
  tags: string[];
  onlyFromThisDashboard: boolean;
  onlyInTimeRange: boolean;

  showTags: boolean;
  showUser: boolean;
  showTime: boolean;

  navigateBefore: string;
  navigateAfter: string;
  navigateToPanel: boolean;
}

export const defaults: AnnoOptions = {
  limit: 10,
  tags: [],
  onlyFromThisDashboard: false,
  onlyInTimeRange: false,

  showTags: true,
  showUser: true,
  showTime: true,

  navigateBefore: '10m',
  navigateAfter: '10m',
  navigateToPanel: true,
};
