export type Settings = { [key: string]: SettingsSection };

export type SettingsSection = Record<string, string>;
export type VerboseSettingsSection = Record<string, Record<string, string>>;

export interface UpdateSettingsQuery {
  updates?: Settings;
  removals?: Record<string, string[]>;
}
