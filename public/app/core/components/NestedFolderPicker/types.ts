export const ROOT_FOLDER: unique symbol = Symbol('Root folder');

export type FolderUID = string | typeof ROOT_FOLDER;
export type FolderChange = { title: string; uid: FolderUID };
