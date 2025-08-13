import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { StandardEditorProps, DataFrame, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { FrameGeometrySource, FrameGeometrySourceMode } from '@grafana/schema';
import { Alert, HorizontalGroup, Icon, Select, useStyles2 } from '@grafana/ui';

import { FrameGeometryField, getGeometryField, getLocationMatchers } from '../utils/location';

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
  id,
}: StandardEditorProps<string, ModeEditorSettings, unknown, unknown>) => {
  const [info, setInfo] = useState<FrameGeometryField>();

  const MODE_OPTIONS = [
    {
      value: FrameGeometrySourceMode.Auto,
      label: t('geo.location-more-editor.mode-options.label-auto', 'Auto'),
      ariaLabel: selectors.components.Transforms.SpatialOperations.location.autoOption,
      description: t(
        'geo.location-more-editor.mode-options.description-auto',
        'Automatically identify location data based on default field names'
      ),
    },
    {
      value: FrameGeometrySourceMode.Coords,
      label: t('geo.location-more-editor.mode-options.label-coords', 'Coords'),
      ariaLabel: selectors.components.Transforms.SpatialOperations.location.coords.option,
      description: t(
        'geo.location-more-editor.mode-options.description-coords',
        'Specify latitude and longitude fields'
      ),
    },
    {
      value: FrameGeometrySourceMode.Geohash,
      label: t('geo.location-more-editor.mode-options.label-geohash', 'Geohash'),
      ariaLabel: selectors.components.Transforms.SpatialOperations.location.geohash.option,
      description: t('geo.location-more-editor.mode-options.description-geohash', 'Specify geohash field'),
    },
    {
      value: FrameGeometrySourceMode.Lookup,
      label: t('geo.location-more-editor.mode-options.label-lookup', 'Lookup'),
      ariaLabel: selectors.components.Transforms.SpatialOperations.location.lookup.option,
      description: t('geo.location-more-editor.mode-options.description-lookup', 'Specify Gazetteer and lookup field'),
    },
  ];

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
        inputId={id}
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
    alert: css({
      '& div': {
        padding: theme.spacing(0.5),
      },
      marginBottom: '0px',
      marginTop: '5px',
      padding: theme.spacing(0.25),
    }),
    // TODO apply styling to horizontal group (currently not working)
    hGroup: css({
      '& div': {
        width: '100%',
      },
    }),
  };
};
