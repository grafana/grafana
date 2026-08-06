import { useMemo } from 'react';

import { useTheme2 } from '../../../../themes/ThemeContext';
import { type TypographyCtx } from '../types';
import { extractPixelValue } from '../utils/fields';
import { createTypographyContext } from '../utils/typography';

/**
 * Typography context for measuring body text, derived from the current theme.
 */
export function useTypographyCtx(): TypographyCtx {
  const theme = useTheme2();
  return useMemo(
    () =>
      createTypographyContext(
        theme.typography.fontSize,
        theme.typography.fontFamily,
        extractPixelValue(theme.typography.body.letterSpacing!) * theme.typography.fontSize
      ),
    [theme]
  );
}
