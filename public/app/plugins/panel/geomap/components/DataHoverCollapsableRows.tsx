import React from 'react';
import { Collapse, TabContent } from '@grafana/ui';

import { GeomapLayerHover } from '../event';

type Props = {
  layers?: GeomapLayerHover[];
  activeTabIndex: number;
};

export const DataHoverCollapsibleRows = ({ layers, activeTabIndex }: Props) => {
  const rows =
    (layers &&
      layers.map(
        (g, index) =>
          index === activeTabIndex && (
            <div key={g.layer.getName()}>
              <div>
                {g.features.map((f, idx) => (
                  <Collapse key={idx} collapsible label={f.get('name')} isOpen={false} onToggle={() => {}}>
                    <div>FEATURE: {`${f}`}</div>
                  </Collapse>
                ))}
              </div>
            </div>
          )
      )) ??
    null;

  return <TabContent>{rows}</TabContent>;
};
