import React, { useState } from 'react';
import { Collapse, TabContent, useStyles2 } from '@grafana/ui';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

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

  const renderDataHoverView = (layer: HeatmapLayerHover, dataFrame: DataFrame): JSX.Element => {
    return (
      <>
        {layer.header && layer.header()}
        <DataHoverRow data={dataFrame} rowIndex={0} />
        {layer.footer && layer.footer()}
      </>
    );
  };

  return (
    <TabContent>
      {layers.map(
        (layer, index) =>
          index === activeTabIndex && (
            <div key={layer.name}>
              <div>
                {layer.data.map((dataFrame, idx) => {
                  const key = dataFrame.refId ?? idx;
                  const shouldDisplayCollapse = layer.data.length > 1;

                  return shouldDisplayCollapse ? (
                    <Collapse
                      key={key}
                      collapsible
                      label={dataFrame.name}
                      isOpen={rowMap.get(key)}
                      onToggle={() => {
                        updateRowMap(key, !rowMap.get(key));
                      }}
                      className={styles.collapsibleRow}
                    >
                      {renderDataHoverView(layer, dataFrame)}
                    </Collapse>
                  ) : (
                    renderDataHoverView(layer, dataFrame)
                  );
                })}
              </div>
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
