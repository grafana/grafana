export type Settings = { [key: string]: SettingsSection };

export type SettingsSection = { [key: string]: string };

export interface UpdateSettingsQuery {
  updates?: Settings;
  removals?: { [key: string]: string[] };
}
