import { type EventProperty } from '@grafana/runtime/unstable';

export interface SaveButtonClicked extends EventProperty {
  /** Whether the preference being saved belongs to an org, team, or individual user. */
  preferenceType: 'org' | 'team' | 'user';
  /** The theme value at the time of saving, if one is set. */
  theme?: string;
  /** The language value at the time of saving, if one is set. */
  language?: string;
}

export interface ThemeChanged extends EventProperty {
  /** Whether the preference being changed belongs to an org, team, or individual user. */
  preferenceType: 'org' | 'team' | 'user';
  /** The theme the user switched to. */
  toTheme: string;
}

export interface LanguageChanged extends EventProperty {
  /** Whether the preference being changed belongs to an org, team, or individual user. */
  preferenceType: 'org' | 'team' | 'user';
  /** The language the user switched to. */
  toLanguage: string;
}
