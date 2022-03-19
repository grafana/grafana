export type SaveTarget = 'new_dashboard' | 'existing_dashboard';

interface SaveTargetDTO {
  saveTarget: SaveTarget;
}

export interface SaveToNewDashboardDTO extends SaveTargetDTO {
  dashboardName: string;
  folderId: number;
  saveTarget: 'new_dashboard';
}

export interface SaveToExistingDashboardDTO extends SaveTargetDTO {
  dashboard: {
    uid: string;
    title: string;
  };
  saveTarget: 'existing_dashboard';
}

export type FormDTO = SaveToNewDashboardDTO | SaveToExistingDashboardDTO;

export const isSaveToNewDashboardDTO = (data: FormDTO): data is SaveToNewDashboardDTO & { saveTarget: SaveTarget } =>
  data.saveTarget === 'new_dashboard';

export interface ErrorResponse {
  status: string;
  message?: string;
}
