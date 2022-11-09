import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import {
  StandardEditorProps,
  FrameGeometrySourceMode,
  DataFrame,
  FrameGeometrySource,
  GrafanaTheme2,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, HorizontalGroup, Icon, RadioButtonGroup, useStyles2 } from '@grafana/ui';

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
            onRemove={() => {
              const newWindow = window.open(helpUrl, '_blank', 'noopener,noreferrer');
              if (newWindow) {
                newWindow.opener = null;
              }
            }}
          />
        );
      } else if (value === FrameGeometrySourceMode.Auto && info.description) {
        return <span className={styles.autoSuccess}>{info.description}</span>;
      }
    }
    return null;
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
      <HorizontalGroup className={styles.hGroup}>{dataValidation()}</HorizontalGroup>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    autoSuccess: css`
      color: ${theme.colors.success.text};
    `,
    // TODO apply styling to horizontal group (currently not working)
    hGroup: css`
      & div {
        width: 100%;
      }
    `,
  };
};
