import { DataFrame, DataFrameFieldIndex, Field } from '@grafana/data';
import { XYFieldMatchers } from './types';
import React, { useCallback, useContext } from 'react';

/** @alpha */
interface GraphNGContextType {
  mapSeriesIndexToDataFrameFieldIndex: (index: number) => DataFrameFieldIndex;
  dimFields: XYFieldMatchers;
}

/** @alpha */
export const GraphNGContext = React.createContext<GraphNGContextType>({} as GraphNGContextType);

/**
 * @alpha
 * Exposes API for data frame inspection in Plot plugins
 */
export const useGraphNGContext = () => {
  const graphCtx = useContext<GraphNGContextType>(GraphNGContext);

  const getXAxisField = useCallback(
    (data: DataFrame[]) => {
      const xFieldMatcher = graphCtx.dimFields.x;
      let xField: Field | null = null;

      for (let i = 0; i < data.length; i++) {
        const frame = data[i];
        for (let j = 0; j < frame.fields.length; j++) {
          if (xFieldMatcher(frame.fields[j], frame, data)) {
            xField = frame.fields[j];
            break;
          }
        }
      }

      return xField;
    },
    [graphCtx]
  );

  return {
    ...graphCtx,
    getXAxisField,
  };
};
