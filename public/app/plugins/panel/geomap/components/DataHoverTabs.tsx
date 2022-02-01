import React, { Dispatch, SetStateAction } from 'react';
import { Tab, TabsBar } from '@grafana/ui';

import { GeomapLayerHover } from '../event';

type Props = {
  layers?: GeomapLayerHover[];
  setActiveTabIndex: Dispatch<SetStateAction<number>>;
  activeTabIndex: number;
};

export const DataHoverTabs = ({ layers, setActiveTabIndex, activeTabIndex }: Props) => {
  return (
    <div
      onClick={(e) => {
        console.log('sup', e);
      }}
    >
      <TabsBar>
        {layers &&
          layers.map((g, index) => (
            <div
              key={index}
              onClick={(e) => {
                console.log('sup', e, index);
                setActiveTabIndex(index);
              }}
            >
              <Tab
                key={index}
                label={g.layer.getName()}
                active={index === activeTabIndex}
                counter={g.features.length}
                onChangeTab={() => {
                  console.log('hi??', index);
                  setActiveTabIndex(index);
                }}
              />
            </div>
          ))}
      </TabsBar>
    </div>
  );
};
