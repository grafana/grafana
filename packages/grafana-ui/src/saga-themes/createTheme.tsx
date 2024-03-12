import border from './code/core/border';
import breakpoint from './code/core/breakpoint';
import spacing from './code/core/spacing';
import typography from './code/semantic/typography';
import zIndex from './code/semantic/zIndex';
import ThemeType from './code/themes/theme.d';

export function createTheme(theme: ThemeType) {
  return {
    ...typography,
    ...zIndex,
    ...border,
    ...breakpoint,
    ...spacing,
    ...theme,
  };
}

export type GrafanaTheme3 = ReturnType<typeof createTheme>;
