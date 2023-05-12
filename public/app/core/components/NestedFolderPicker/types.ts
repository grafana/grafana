export interface RootFolder {
  title: string;
  id?: number;
  uid: string;
}

export type RootFolderWithUiState = RootFolder & {
  level: number;
  expanded: boolean;
};
