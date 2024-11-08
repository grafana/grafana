export type OnNodeUpdate = (path: string[], isExpanded: boolean, query: string) => void;
export type OnNodeSelectToggle = (path: string[]) => void;
export type OnFolderUpdate = (path: string[], isExpanded: boolean) => void;
