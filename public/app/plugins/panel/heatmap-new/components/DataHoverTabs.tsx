import React, { Dispatch, SetStateAction } from 'react';
import { Tab, TabsBar } from '@grafana/ui';

import { HeatmapLayerHover } from '../types';

type Props = {
  layers?: HeatmapLayerHover[];
  setActiveTabIndex: Dispatch<SetStateAction<number>>;
  activeTabIndex: number;
};

export const DataHoverTabs = ({ layers, setActiveTabIndex, activeTabIndex }: Props) => {
  return (
    <TabsBar>
      {layers &&
        layers.map(
          (g, index) =>
            g.data.length > 0 && (
              <Tab
                key={index}
                label={g.name}
                active={index === activeTabIndex}
                counter={g.data.length > 1 ? g.data.length : null}
                onChangeTab={() => {
                  setActiveTabIndex(index);
                }}
              />
            )
        )}
    </TabsBar>
  );
};
