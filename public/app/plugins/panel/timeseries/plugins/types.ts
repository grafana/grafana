interface AnnotationsDataFrameViewDTO {
  id: string;
  dashboardId: number;
  time: number;
  timeEnd: number;
  text: string;
  tags: string[];
  alertId?: number;
  newState?: string;
  title?: string;
  color: string;
  login?: string;
  avatarUrl?: string;
  isRegion?: boolean;
}
