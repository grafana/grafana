import React, { FC, useEffect, useMemo } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Select } from '@grafana/ui';
import { GeomapPanelOptions, MapCenterConfig } from '../types';
import { centerPointRegistry, MapCenterID } from '../view';

export const MapCenterEditor: FC<StandardEditorProps<MapCenterConfig, any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const views = useMemo(() => {
    const ids: string[] = [];
    if (value?.id) {
      ids.push(value.id);
    } else {
      ids.push(centerPointRegistry.list()[0].id);
    }
    return centerPointRegistry.selectOptions(ids);
  }, [value?.id]);

  useEffect(() => {
    if (!context.builder) {
      return;
    }

    const category = ['Map View'];
    // let optionsToRemove: string[] = [];

    if (views.current[0].value === MapCenterID.Coordinates) {
      context.builder
        .addSliderInput({
          path: 'view.center.lat',
          name: 'Latitude',
          category,
          settings: {
            min: -90,
            max: 90,
          },
        })
        .addSliderInput({
          path: 'view.center.lon',
          name: 'longitude',
          category,
          settings: {
            min: -180,
            max: 180,
          },
        });
      // optionsToRemove = ['view.center.lat', 'view.center.lon'];
    }

    // return () => {
    //   if (context.builder && optionsToRemove.length > 0) {
    //     for (let i = 0; i < optionsToRemove.length; i++) {
    //       console.log('remove', optionsToRemove[i]);
    //       context.builder.remove(optionsToRemove[i]);
    //     }
    //   }
    // };
  }, [views, context.builder]);

  return (
    <Select
      options={views.options}
      value={views.current}
      onChange={(v) => {
        onChange({
          id: v.value!,
        });
      }}
    />
  );
};
