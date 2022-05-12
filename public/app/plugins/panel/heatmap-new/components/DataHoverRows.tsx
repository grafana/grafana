import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Collapse, TabContent, useStyles2 } from '@grafana/ui';

import { HeatmapLayerHover } from '../types';

import { DataHoverRow } from './DataHoverRow';

type Props = {
  layers: HeatmapLayerHover[];
  activeTabIndex: number;
};

export const DataHoverRows = ({ layers, activeTabIndex }: Props) => {
  const styles = useStyles2(getStyles);
  const [rowMap, setRowMap] = useState(new Map<string | number, boolean>());

  const updateRowMap = (key: string | number, value: boolean) => {
    setRowMap(new Map(rowMap.set(key, value)));
  };

  return (
    <TabContent>
      {layers.map(
        (layer, index) =>
          index === activeTabIndex && (
            <div key={layer.name}>
              {layer.header && layer.header()}
              <div>
                {layer.indicies &&
                  layer.data &&
                  layer.indicies.map((rowIndex, idx) => {
                    const key = `${layer.data?.refId ?? ''}${idx}`;
                    const shouldDisplayCollapse = layer.indicies && layer.indicies.length > 1;

                    return shouldDisplayCollapse ? (
                      <Collapse
                        key={key}
                        collapsible
                        label={`${layer.data?.name} ${idx + 1}`}
                        isOpen={rowMap.get(key)}
                        onToggle={() => {
                          updateRowMap(key, !rowMap.get(key));
                        }}
                        className={styles.collapsibleRow}
                      >
                        <DataHoverRow data={layer.data!} rowIndex={rowIndex} />
                      </Collapse>
                    ) : (
                      <DataHoverRow key={key} data={layer.data!} rowIndex={rowIndex} />
                    );
                  })}
              </div>
              {layer.footer && layer.footer()}
            </div>
          )
      )}
    </TabContent>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  collapsibleRow: css`
    margin-bottom: 0px;
  `,
});
