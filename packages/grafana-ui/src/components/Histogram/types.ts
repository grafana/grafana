/**
 * @alpha
 */
export interface HistogramFieldConfig {
  lineWidth?: number; // 0
  fillOpacity?: number; // 100
  //gradientMode?: GraphGradientMode;
}

/**
 * @alpha
 */
export const defaultHistogramFieldConfig: HistogramFieldConfig = {
  lineWidth: 1,
  fillOpacity: 80,
  //gradientMode: GraphGradientMode.None,
};
