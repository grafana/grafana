import border from './code/core/border';
import breakpoint from './code/core/breakpoint';
import spacing from './code/core/spacing';
import typography from './code/semantic/typography';
import zIndex from './code/semantic/zIndex';
import { Spacing } from './code/themes/spacing';
import { RootObject as ThemeType } from './code/themes/theme';

type SpacingTokens = keyof Spacing;

const spacingFn = (...args: SpacingTokens[]): string => {
  if (process.env.NODE_ENV !== 'production') {
    if (!(args.length <= 4)) {
      console.error(`Too many arguments provided, expected between 0 and 4, got ${args.length}`);
    }
  }

  if (args.length === 0) {
    args[0] = 100;
  }

  return args
    .map((argument) => {
      return spacing.spacing[argument];
    })
    .join(' ');
};

export function createTheme(theme: ThemeType) {
  return {
    ...typography,
    ...zIndex,
    ...border,
    ...breakpoint,
    ...spacing,
    spacingFn,
    ...theme,
  };
}

export type GrafanaTheme3 = ReturnType<typeof createTheme>;
