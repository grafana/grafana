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
            ((g.indicies && g.indicies?.length > 0) || g.header || g.footer) && (
              <Tab
                key={index}
                label={g.name}
                active={index === activeTabIndex}
                counter={g.indicies && g.indicies.length > 1 ? g.indicies.length : null}
                onChangeTab={() => {
                  setActiveTabIndex(index);
                }}
              />
            )
        )}
    </TabsBar>
  );
};
