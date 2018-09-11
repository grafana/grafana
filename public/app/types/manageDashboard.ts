export interface DashboardListItem {
  id: number;
  uid: string;
  title: string;
  uri: string;
  url: string;
  type: string;
  tags: [];
  isStarred: boolean;
}

export interface ManageDashboardState {
  searchQuery: string;
  listItems: DashboardListItem[];
}
