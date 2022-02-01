import React from 'react';
import { FeatureLike } from 'ol/Feature';
import { ArrayDataFrame, DataFrame } from '@grafana/data';

import { DataHoverView } from './DataHoverView';

type Props = {
  feature?: FeatureLike;
};

export const DataHoverRow = ({ feature }: Props) => {
  let data: DataFrame;
  let rowIndex = 0;
  if (feature) {
    const { geometry, ...properties } = feature.getProperties();
    data = new ArrayDataFrame([properties]);
  } else {
    return null;
  }

  return <DataHoverView data={data} rowIndex={rowIndex} />;
};
