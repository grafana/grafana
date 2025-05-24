/**
 * Registry of panel types that support timeCompare
 */
export const timeCompareSupportedPanels = new Set<string>(['timeseries']);

/**
 * Check if a panel type supports timeCompare
 */
export function isTimeCompareSupported(panelType: string): boolean {
  return timeCompareSupportedPanels.has(panelType);
}
