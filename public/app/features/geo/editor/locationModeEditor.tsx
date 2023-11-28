import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { StandardEditorProps, DataFrame, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FrameGeometrySource, FrameGeometrySourceMode } from '@grafana/schema';
import { Alert, HorizontalGroup, Icon, Select, useStyles2 } from '@grafana/ui';

import { FrameGeometryField, getGeometryField, getLocationMatchers } from '../utils/location';

const MODE_OPTIONS = [
  {
    value: FrameGeometrySourceMode.Auto,
    label: 'Auto',
    ariaLabel: selectors.components.Transforms.SpatialOperations.location.autoOption,
    description: 'Automatically identify location data based on default field names',
  },
  {
    value: FrameGeometrySourceMode.Coords,
    label: 'Coords',
    ariaLabel: selectors.components.Transforms.SpatialOperations.location.coords.option,
    description: 'Specify latitude and longitude fields',
  },
  {
    value: FrameGeometrySourceMode.Geohash,
    label: 'Geohash',
    ariaLabel: selectors.components.Transforms.SpatialOperations.location.geohash.option,
    description: 'Specify geohash field',
  },
  {
    value: FrameGeometrySourceMode.Lookup,
    label: 'Lookup',
    ariaLabel: selectors.components.Transforms.SpatialOperations.location.lookup.option,
    description: 'Specify Gazetteer and lookup field',
  },
];

interface ModeEditorSettings {
  data?: DataFrame[];
  source?: FrameGeometrySource;
}

const helpUrl = 'https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/geomap/#location';

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

  const styles = useStyles2(getStyles);

  const dataValidation = () => {
    if (info) {
      if (info.warning) {
        return (
          <Alert
            title={info.warning}
            severity="warning"
            buttonContent={<Icon name="question-circle" size="xl" />}
            className={styles.alert}
            onRemove={() => {
              const newWindow = window.open(helpUrl, '_blank', 'noopener,noreferrer');
              if (newWindow) {
                newWindow.opener = null;
              }
            }}
          />
        );
      } else if (value === FrameGeometrySourceMode.Auto && info.description) {
        return <span>{info.description}</span>;
      }
    }
    return null;
  };

  return (
    <>
      <Select
        options={MODE_OPTIONS}
        value={value}
        onChange={(v) => {
          onChange(v.value);
        }}
      />
      <HorizontalGroup className={styles.hGroup}>{dataValidation()}</HorizontalGroup>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    alert: css`
      & div {
        padding: 4px;
      }
      margin-bottom: 0px;
      margin-top: 5px;
      padding: 2px;
    `,
    // TODO apply styling to horizontal group (currently not working)
    hGroup: css`
      & div {
        width: 100%;
      }
    `,
  };
};
