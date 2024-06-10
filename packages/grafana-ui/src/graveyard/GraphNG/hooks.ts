import React, { useCallback, useContext } from 'react';

import { DataFrame, DataFrameFieldIndex, Field } from '@grafana/data';

import { XYFieldMatchers } from './types';

/** @deprecated */
interface GraphNGContextType {
  mapSeriesIndexToDataFrameFieldIndex: (index: number) => DataFrameFieldIndex;
  dimFields: XYFieldMatchers;
  data: DataFrame;
}

/** @deprecated */
export const GraphNGContext = React.createContext<GraphNGContextType>({} as GraphNGContextType);

/** @deprecated */
export const useGraphNGContext = () => {
  const { data, dimFields, mapSeriesIndexToDataFrameFieldIndex } = useContext<GraphNGContextType>(GraphNGContext);

  const getXAxisField = useCallback(() => {
    const xFieldMatcher = dimFields.x;
    let xField: Field | null = null;

    for (let j = 0; j < data.fields.length; j++) {
      if (xFieldMatcher(data.fields[j], data, [data])) {
        xField = data.fields[j];
        break;
      }
    }

    return xField;
  }, [data, dimFields]);

  return {
    dimFields,
    mapSeriesIndexToDataFrameFieldIndex,
    getXAxisField,
    alignedData: data,
  };
};
