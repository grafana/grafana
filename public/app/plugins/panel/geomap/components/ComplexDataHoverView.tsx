import React, { useState } from 'react';

import { GeomapLayerHover } from '../event';
import { DataHoverTabs } from './DataHoverTabs';
import { DataHoverRows } from './DataHoverRows';

export interface Props {
  layers?: GeomapLayerHover[];
}

export const ComplexDataHoverView = (props: Props) => {
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  console.log(activeTabIndex, 'what is this?');

  const { layers } = props;
  if (layers) {
    return (
      <>
        <DataHoverTabs layers={layers} setActiveTabIndex={setActiveTabIndex} activeTabIndex={activeTabIndex} />
        <DataHoverRows layers={layers} activeTabIndex={activeTabIndex} />
      </>
    );
  } else {
    return null;
  }
};
