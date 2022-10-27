import React, { useEffect, useState } from 'react';

import { StandardEditorProps, FrameGeometrySourceMode, DataFrame, FrameGeometrySource } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, HorizontalGroup, RadioButtonGroup } from '@grafana/ui';

import { FrameGeometryField, getGeometryField, getLocationMatchers } from '../utils/location';

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

interface ModeEditorSettings {
  data?: DataFrame[];
  source?: FrameGeometrySource;
}

export const LocationModeEditor = ({
  value,
  onChange,
  context,
  item,
}: StandardEditorProps<string, ModeEditorSettings, unknown, unknown>) => {
  const [info, setInfo] = useState<FrameGeometryField>();

  useEffect(() => {
    if (item.settings?.source && item.settings?.data?.length && item.settings.data[0]) {
      getLocationMatchers(item.settings.source).then((location) => {
        if (item.settings && item.settings.data) {
          setInfo(getGeometryField(item.settings.data[0], location));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.settings]);

  // TODO extend for other cases, for example auto when it's happy
  const dataValidation = () => {
    if (info && info.warning) {
      return <Alert title={info.warning} severity="warning" />;
    } else {
      return null;
    }
  };

  return (
    <>
      <RadioButtonGroup
        value={value}
        options={MODE_OPTIONS}
        onChange={(v) => {
          onChange(v);
        }}
      />
      <HorizontalGroup>{dataValidation()}</HorizontalGroup>
    </>
  );
};
