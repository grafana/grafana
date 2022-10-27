import { css } from '@emotion/css';
import React from 'react';

import { StandardEditorProps, GrafanaTheme2, FrameGeometrySourceMode } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { RadioButtonGroup, stylesFactory, useTheme2 } from '@grafana/ui';

const MODE_OPTIONS = [
  {
    value: FrameGeometrySourceMode.Auto,
    label: 'Auto',
    ariaLabel: selectors.components.Transforms.SpatialOperations.location.autoOption,
  },
  {
    value: FrameGeometrySourceMode.Coords,
    label: 'Coords',
    ariaLabel: selectors.components.Transforms.SpatialOperations.location.coords.option,
  },
  {
    value: FrameGeometrySourceMode.Geohash,
    label: 'Geohash',
    ariaLabel: selectors.components.Transforms.SpatialOperations.location.geohash.option,
  },
  {
    value: FrameGeometrySourceMode.Lookup,
    label: 'Lookup',
    ariaLabel: selectors.components.Transforms.SpatialOperations.location.lookup.option,
  },
];

export const LocationModeEditor = ({
  value,
  onChange,
  context,
  item,
}: StandardEditorProps<string, unknown, unknown, unknown>) => {
  const styles = getStyles(useTheme2());

  return (
    <>
      <div>test</div>
      <RadioButtonGroup
        value={value}
        options={MODE_OPTIONS}
        onChange={(v) => {
          onChange(v);
        }}
      />
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    keys: css`
      margin-top: 4px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;

      > span {
        margin-left: 4px;
      }
    `,
  };
});
