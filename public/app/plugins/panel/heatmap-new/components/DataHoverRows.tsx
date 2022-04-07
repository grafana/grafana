import React, { useState } from 'react';
import { Collapse, TabContent, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

import { ExemplarLayerHover } from '../event';
import { DataHoverRow } from './DataHoverRow';

type Props = {
  layers: ExemplarLayerHover[];
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
                      <DataHoverRow data={dataFrame} rowIndex={0} />
                    </Collapse>
                  ) : (
                    <DataHoverRow key={key} data={dataFrame} rowIndex={0} />
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
