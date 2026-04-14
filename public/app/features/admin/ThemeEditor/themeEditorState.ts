import { createTheme, type GrafanaTheme2, type NewThemeOptions } from '@grafana/data';

/**
 * Simplified editor model that maps to the full NewThemeOptions schema.
 * Users edit these few high-level values; derived tokens (borders, actions, gradients)
 * are computed automatically by createTheme().
 */
export interface ThemeEditorState {
  name: string;
  id: string;
  mode: 'dark' | 'light';
  colors: {
    primary: string;
    background: string;
    surface: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    textPrimary: string;
  };
}

export const DEFAULT_DARK_STATE: ThemeEditorState = {
  name: 'Custom dark',
  id: 'custom-dark',
  mode: 'dark',
  colors: {
    primary: '#3D71D9',
    background: '#111217',
    surface: '#181B1F',
    success: '#1A7F4B',
    warning: '#F5B73D',
    error: '#E0226E',
    info: '#3D71D9',
    textPrimary: '#CCCCDC',
  },
};

export const DEFAULT_LIGHT_STATE: ThemeEditorState = {
  name: 'Custom light',
  id: 'custom-light',
  mode: 'light',
  colors: {
    primary: '#3871DC',
    background: '#F1F5F9',
    surface: '#FFFFFF',
    success: '#1B855E',
    warning: '#FF9900',
    error: '#E0226E',
    info: '#3871DC',
    textPrimary: '#1E2028',
  },
};

/** Convert the simplified editor state to the full NewThemeOptions schema */
export function editorStateToThemeOptions(state: ThemeEditorState): Omit<NewThemeOptions, 'id' | 'name'> & {
  name: string;
} {
  return {
    name: state.name,
    colors: {
      mode: state.mode,
      primary: { main: state.colors.primary },
      success: { main: state.colors.success },
      warning: { main: state.colors.warning },
      error: { main: state.colors.error },
      info: { main: state.colors.info },
      background: {
        canvas: state.colors.background,
        primary: state.colors.surface,
      },
      text: {
        primary: state.colors.textPrimary,
      },
    },
  };
}

/** Build a real GrafanaTheme2 from the editor state */
export function buildThemeFromState(state: ThemeEditorState): GrafanaTheme2 {
  return createTheme(editorStateToThemeOptions(state));
}

/** Serialize editor state to a full theme JSON suitable for themeDefinitions/ */
export function exportThemeJSON(state: ThemeEditorState): string {
  const themeOptions = editorStateToThemeOptions(state);
  const options: NewThemeOptions = {
    id: state.id,
    name: themeOptions.name,
    colors: themeOptions.colors,
  };
  return JSON.stringify(options, null, 2);
}

/** Attempt to import a theme JSON string into editor state */
export function importThemeJSON(json: string): ThemeEditorState | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.name || !parsed.colors?.mode) {
      return null;
    }
    return {
      name: parsed.name ?? 'Imported theme',
      id: parsed.id ?? `custom-${Date.now()}`,
      mode: parsed.colors.mode === 'light' ? 'light' : 'dark',
      colors: {
        primary: parsed.colors.primary?.main ?? DEFAULT_DARK_STATE.colors.primary,
        background: parsed.colors.background?.canvas ?? DEFAULT_DARK_STATE.colors.background,
        surface: parsed.colors.background?.primary ?? DEFAULT_DARK_STATE.colors.surface,
        success: parsed.colors.success?.main ?? DEFAULT_DARK_STATE.colors.success,
        warning: parsed.colors.warning?.main ?? DEFAULT_DARK_STATE.colors.warning,
        error: parsed.colors.error?.main ?? DEFAULT_DARK_STATE.colors.error,
        info: parsed.colors.info?.main ?? DEFAULT_DARK_STATE.colors.info,
        textPrimary: parsed.colors.text?.primary ?? DEFAULT_DARK_STATE.colors.textPrimary,
      },
    };
  } catch {
    return null;
  }
}
