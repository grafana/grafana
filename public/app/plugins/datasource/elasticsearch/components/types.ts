export type SettingKeyOf<T extends { settings?: Record<string, unknown> }> = Extract<
  keyof NonNullable<T['settings']>,
  string
>;
