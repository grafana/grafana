import { useState } from 'react';

import { type FlameGraphDataContainer } from './FlameGraph/dataTransform';
import { ColorScheme, ColorSchemeDiff, DataSourceType } from './types';

/**
 * Manages the color scheme state, resetting it when the data changes between
 * diff and non-diff profiles.
 */
export function useColorScheme(dataContainer: FlameGraphDataContainer | undefined) {
  const defaultColorScheme = dataContainer?.isDiffFlamegraph() ? ColorSchemeDiff.Default : ColorScheme.PackageBased;
  const [colorScheme, setColorScheme] = useState<ColorScheme | ColorSchemeDiff>(defaultColorScheme);

  const [prevDefaultColorScheme, setPrevDefaultColorScheme] = useState(defaultColorScheme);
  if (prevDefaultColorScheme !== defaultColorScheme) {
    setPrevDefaultColorScheme(defaultColorScheme);
    setColorScheme(defaultColorScheme);
  }

  // kernel/user space scheme is only offered for Pyroscope data, so never apply it to anything else.
  const isSpaceSchemeAvailable = dataContainer?.getDataSource() === DataSourceType.PprofPyroscope;
  const effectiveColorScheme =
    colorScheme === ColorScheme.SpaceBased && !isSpaceSchemeAvailable ? defaultColorScheme : colorScheme;

  return [effectiveColorScheme, setColorScheme] as const;
}
