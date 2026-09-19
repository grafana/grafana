type NullableString = null | string;
type NullableNumber = null | number;
// the legacy annotation API returns numeric ids while the app platform API returns string uids, so both can arrive here
export type AnnotationId = string | number;
type NullableId = null | AnnotationId;
export type AnnotationVals = {
  // layout
  time: number[];
  timeEnd?: NullableNumber[];
  isRegion?: boolean[];
  isCluster?: boolean[];
  color?: string[];

  // meta
  id?: NullableId[];
  alertId?: NullableNumber[];

  // tooltip
  text?: NullableString[];
  title?: NullableString[];
  dashboardUID?: NullableString[];
  newState?: NullableString[];
  login?: NullableString[];
  avatarUrl?: NullableString[];

  // only added in clustered annos
  clusterIdx?: NullableNumber[];

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
