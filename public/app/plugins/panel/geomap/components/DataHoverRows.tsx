import React, { useState } from 'react';
import { Collapse, TabContent } from '@grafana/ui';

import { GeomapLayerHover } from '../event';
import { DataHoverRow } from './DataHoverRow';

type Props = {
  layers?: GeomapLayerHover[];
  activeTabIndex: number;
};

export const DataHoverRows = ({ layers, activeTabIndex }: Props) => {
  const [rowMap, setRowMap] = useState(new Map<number, boolean>());

  const updateRowMap = (key: number, value: boolean) => {
    setRowMap(new Map(rowMap.set(key, value)));
  };

  const rows =
    (layers &&
      layers.map(
        (g, index) =>
          index === activeTabIndex && (
            <div key={g.layer.getName()}>
              <div>
                {g.features.map((f, idx) => {
                  return (
                    <Collapse
                      key={idx}
                      collapsible
                      label={f.get('name')}
                      isOpen={rowMap.get(idx)}
                      onToggle={() => {
                        updateRowMap(idx, !rowMap.get(idx));
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

  return <TabContent>{rows}</TabContent>;
};
