import {
  DataFrame,
  DataQuery,
  StandardAnnotationQuery,
  AnnotationProcessor,
  PanelData,
  transformDataFrame,
} from '@grafana/data';

export const standardAnnotationProcessor: AnnotationProcessor = {
  /**
   * Assume the stored value is standard model.
   */
  prepareAnnotation: (json: any) => json as StandardAnnotationQuery<DataQuery>,

  /**
   * Convert the stored JSON model and environment to a standard datasource query object.
   * This query will be executed in the datasource and the results converted into events.
   * Returning an undefined result will quietly skip query execution
   */
  prepareQuery: (anno: StandardAnnotationQuery<DataQuery>) => anno.query,

  /**
   * When the standard frame > event processing is insufficient, this allows explicit control of the mappings
   */
  processEvents: (anno: StandardAnnotationQuery<DataQuery>, data: DataFrame) => {
    return [];
  },
};

/**
 * Flatten all panel data into a single frame
 */
export function singleFrameFromPanelData(rsp: PanelData): DataFrame | undefined {
  if (rsp?.series?.length) {
    return undefined;
  }
  if (rsp.series.length === 1) {
    return rsp.series[0];
  }

  return transformDataFrame(
    [
      {
        id: 'seriesToColumns',
        options: { byField: 'Time' },
      },
    ],
    rsp.series
  )[0];
}
