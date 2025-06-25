import { css } from '@emotion/css';
import { isString } from 'lodash';
import { FeatureLike } from 'ol/Feature';
import { useState } from 'react';
import * as React from 'react';

import { DataFrame, FieldType, getFieldDisplayName, GrafanaTheme2 } from '@grafana/data';
import { Collapse, TabContent, useStyles2 } from '@grafana/ui';
import { GeomapLayerHover } from 'app/plugins/panel/geomap/event';
import { renderValue } from 'app/plugins/panel/geomap/utils/uiUtils';

import { DataHoverRow } from './DataHoverRow';

type Props = {
  layers: GeomapLayerHover[];
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
                      label={generateLabel(feature, idx)}
                      isOpen={rowMap.get(key)}
                      onToggle={() => {
                        updateRowMap(key, !rowMap.get(key));
                      }}
                      className={styles.collapsibleRow}
                    >
                      <DataHoverRow feature={feature} />
                    </Collapse>
                  ) : (
                    <DataHoverRow key={key} feature={feature} />
                  );
                })}
              </div>
            </div>
          )
      )}
    </TabContent>
  );
};

export const generateLabel = (feature: FeatureLike, idx: number): string | React.ReactNode => {
  const names = ['Name', 'name', 'Title', 'ID', 'id'];
  let props = feature.getProperties();
  let first = '';
  const frame = feature.get('frame') as DataFrame; // eslint-disable-line
  if (frame) {
    const rowIndex = feature.get('rowIndex');
    for (const f of frame.fields) {
      if (f.type === FieldType.string) {
        const k = getFieldDisplayName(f, frame);
        if (!first) {
          first = k;
        }
        props[k] = f.values[rowIndex];
      }
    }
  }

  for (let k of names) {
    const v = props[k];
    if (v) {
      return v;
    }
  }

  if (first) {
    return (
      <span>
        {first}: {renderValue(props[first])}
      </span>
    );
  }

  for (let k of Object.keys(props)) {
    const v = props[k];
    if (isString(v)) {
      return (
        <span>
          {k}: {renderValue(v)}
        </span>
      );
    }
  }

  return `Match: ${idx + 1}`;
};

const getStyles = (theme: GrafanaTheme2) => ({
  collapsibleRow: css({
    marginBottom: 0,
  }),
});
