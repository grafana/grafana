import React, { useState } from 'react';
import { Collapse, TabContent } from '@grafana/ui';

import { GeomapLayerHover } from '../event';
import { DataHoverRow } from './DataHoverRow';
import { FeatureLike } from 'ol/Feature';

type Props = {
  layers?: GeomapLayerHover[];
  activeTabIndex: number;
};

export const DataHoverRows = ({ layers, activeTabIndex }: Props) => {
  const [rowMap, setRowMap] = useState(new Map<string | number, boolean>());

  const updateRowMap = (key: string | number, value: boolean) => {
    setRowMap(new Map(rowMap.set(key, value)));
  };

  const rows =
    (layers &&
      layers.map(
        (geomapLayer, index) =>
          index === activeTabIndex && (
            <div key={geomapLayer.layer.getName()}>
              <div>
                {geomapLayer.features.map((feature, idx) => {
                  const key = feature.getId() ?? idx;
                  const shouldDisplayCollapse = geomapLayer.features.length > 1;

                  return shouldDisplayCollapse ? (
                    <Collapse
                      key={key}
                      collapsible
                      label={generateLabel(feature)}
                      isOpen={rowMap.get(key)}
                      onToggle={() => {
                        updateRowMap(key, !rowMap.get(key));
                      }}
                    >
                      <DataHoverRow feature={feature} />
                    </Collapse>
                  ) : (
                    <DataHoverRow feature={feature} />
                  );
                })}
              </div>
            </div>
          )
      )) ??
    null;

  return <TabContent>{rows}</TabContent>;
};

export const generateLabel = (feature: FeatureLike): string => {
  let label: string;

  label = feature.get('name') ?? feature.get('title') ?? feature.getId();

  if (!label) {
    label = 'Data';
  }

  return label;
};
