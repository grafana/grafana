import React, { useEffect, useState } from 'react';
import { Collapse, TabContent } from '@grafana/ui';

import { GeomapLayerHover } from '../event';
import { DataHoverRow } from './DataHoverRow';

type Props = {
  layers?: GeomapLayerHover[];
  activeTabIndex: number;
};

export const DataHoverRows = ({ layers, activeTabIndex }: Props) => {
  const [rowMap, setRowMap] = useState(new Map<string | number, boolean>());

  const updateRowMap = (key: string | number, value: boolean) => {
    setRowMap(new Map(rowMap.set(key, value)));
  };

  useEffect(() => {
    if (layers) {
      layers.map((layer, index) => {
        layer.features.map((feature, idx) => {
          const key = feature.getId() ?? idx;

          updateRowMap(key, true);
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows =
    (layers &&
      layers.map(
        (geomapLayer, index) =>
          index === activeTabIndex && (
            <div key={geomapLayer.layer.getName()}>
              <div>
                {geomapLayer.features.map((feature, idx) => {
                  const key = feature.getId() ?? idx;
                  return (
                    <Collapse
                      key={key}
                      collapsible
                      label={feature.get('name')}
                      isOpen={rowMap.get(key)}
                      onToggle={() => {
                        updateRowMap(key, !rowMap.get(key));
                      }}
                    >
                      <DataHoverRow feature={feature} />
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
