import { useEffect, useId, useRef, useState } from 'react';

import { type FlameGraphDataContainer } from './FlameGraph/dataTransform';
import { ColorScheme, ColorSchemeDiff } from './types';

/**
 * Manages the color scheme state, resetting it when the data changes between
 * diff and non-diff profiles.
 */
export function useColorScheme(dataContainer: FlameGraphDataContainer | undefined) {
  const defaultColorScheme = dataContainer?.isDiffFlamegraph() ? ColorSchemeDiff.Default : ColorScheme.PackageBased;
  const [colorScheme, setColorScheme] = useState<ColorScheme | ColorSchemeDiff>(defaultColorScheme);

  useEffect(() => {
    setColorScheme(defaultColorScheme);
  }, [defaultColorScheme]);

  return [colorScheme, setColorScheme] as const;
}

export type ReportVisibleTruncatedPaths = (viewId: string, paths: string[][]) => void;

/**
 * Registers the truncated nodes the calling view currently shows with the container, which coalesces all the views
 * into the single set the host is told about. The registration is dropped when the view unmounts, so switching a pane
 * away from a view does not leave its paths behind.
 */
export function useReportVisibleTruncatedPaths(paths: string[][], report?: ReportVisibleTruncatedPaths) {
  const viewId = useId();
  const pathsRef = useRef(paths);
  pathsRef.current = paths;

  // The paths are rebuilt on every render, so the effect has to compare their contents rather than the array.
  const key = JSON.stringify(paths);

  useEffect(() => {
    report?.(viewId, pathsRef.current);
  }, [report, viewId, key]);

  useEffect(() => () => report?.(viewId, []), [report, viewId]);
}
