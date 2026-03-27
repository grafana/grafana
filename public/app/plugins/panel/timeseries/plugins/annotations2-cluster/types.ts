type NullableString = null | string;
type NullableNumber = null | number;
export type AnnotationVals = {
  time: number[];
  isRegion?: boolean[];
  color?: string[];

  id?: NullableNumber[];
  clusterIdx?: NullableNumber[];
  timeEnd?: NullableNumber[];
  alertId?: NullableNumber[];

  text?: NullableString[];
  title?: NullableString[];
  dashboardUID?: NullableString[];
  newState?: NullableString[];
  login?: NullableString[];
  avatarUrl?: NullableString[];

  /** Alert payload per row (e.g. evalMatches, error) for getAlertAnnotationText */
  data?: unknown[];
  tags?: string[][];
};
export type XYAnnoVals = {
  color: string[];
  xMin: number[];
  xMax: number[];
  yMax: number[];
  yMin: number[];
  fillOpacity: number[];
  lineWidth: number[];
  lineStyle: string[];
};
