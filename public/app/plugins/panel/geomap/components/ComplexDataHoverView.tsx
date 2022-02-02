import React, { useState } from 'react';

import { GeomapLayerHover } from '../event';
import { DataHoverTabs } from './DataHoverTabs';
import { DataHoverRows } from './DataHoverRows';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';

export interface Props {
  layers?: GeomapLayerHover[];
  isOpen: boolean;
  onClose: () => void;
}

export const ComplexDataHoverView = ({ layers, onClose, isOpen }: Props) => {
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);

  if (!layers) {
    return null;
  }

  return (
    <>
      {isOpen && <CloseButton style={{ zIndex: 1 }} onClick={onClose} />}
      <DataHoverTabs layers={layers} setActiveTabIndex={setActiveTabIndex} activeTabIndex={activeTabIndex} />
      <DataHoverRows layers={layers} activeTabIndex={activeTabIndex} />
    </>
  );
};
