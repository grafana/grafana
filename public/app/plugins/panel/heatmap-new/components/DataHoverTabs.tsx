import React, { Dispatch, SetStateAction } from 'react';
import { Tab, TabsBar } from '@grafana/ui';

import { ExemplarLayerHover } from '../event';

type Props = {
  layers?: ExemplarLayerHover[];
  setActiveTabIndex: Dispatch<SetStateAction<number>>;
  activeTabIndex: number;
};

export const DataHoverTabs = ({ layers, setActiveTabIndex, activeTabIndex }: Props) => {
  return (
    <TabsBar>
      {layers &&
        layers.map((g, index) => (
          <Tab
            key={index}
            label={g.name}
            active={index === activeTabIndex}
            counter={g.data.length > 1 ? g.data.length : null}
            onChangeTab={() => {
              setActiveTabIndex(index);
            }}
          />
        ))}
    </TabsBar>
  );
};
