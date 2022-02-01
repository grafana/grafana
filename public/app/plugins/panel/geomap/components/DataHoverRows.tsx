import React from 'react';
import { Collapse, TabContent } from '@grafana/ui';

import { GeomapLayerHover } from '../event';
import { DataHoverRow } from './DataHoverRow';

type Props = {
  layers?: GeomapLayerHover[];
  activeTabIndex: number;
};

export const DataHoverRows = ({ layers, activeTabIndex }: Props) => {
  const rowMap = new Map<number, boolean>();

  const rows =
    (layers &&
      layers.map(
        (g, index) =>
          index === activeTabIndex && (
            <div key={g.layer.getName()}>
              <div>
                {g.features.map((f, idx) => {
                  rowMap.set(idx, true);
                  return (
                    <Collapse
                      key={idx}
                      collapsible
                      label={f.get('name')}
                      isOpen={rowMap.get(idx)}
                      onToggle={() => {
                        console.log('ontoggle reachable??');
                        rowMap.set(idx, !rowMap.get(idx));
                      }}
                    >
                      <DataHoverRow feature={f} />
                    </Collapse>
                  );
                })}
              </div>
            </div>
          )
      )) ??
    null;

  console.log(rowMap, 'hm');

  return <TabContent>{rows}</TabContent>;
};
