import React, { FC, useEffect, useMemo } from 'react';
import { GrafanaTheme, StandardEditorProps } from '@grafana/data';
import { Select, stylesFactory, useStyles } from '@grafana/ui';
import { GeomapPanelOptions, MapCenterConfig } from '../types';
import { centerPointRegistry, MapCenterID } from '../view';
import { css } from '@emotion/css';

export const MapCenterEditor: FC<StandardEditorProps<MapCenterConfig, any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const style = useStyles(getStyles);

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
    if (!context.builder || !value) {
      return;
    }
    if (value.id === MapCenterID.Coordinates) {
      context.builder.addNumberInput({
        path: 'view.center.lat',
        category: ['Map View'],
        name: 'Latitude',
        showIf: (o) => o.view.center.id === MapCenterID.Coordinates,
      });
    }
  });

  return (
    <div>
      <Select
        options={views.options}
        value={views.current}
        onChange={(v) => {
          if (v.value === MapCenterID.Coordinates) {
            context.builder?.addNumberInput({
              path: 'view.center.lat',
              category: ['Map View'],
              name: 'Latitude',
              showIf: (o) => o.view.center.id === MapCenterID.Coordinates,
            });
          } else {
            context.builder?.remove('view.center.lat');
          }
          onChange({
            id: v.value!,
          });
        }}
      />
      {/*{value?.id === MapCenterID.Coordinates && (*/}
      {/*  <div>*/}
      {/*    <table className={style.table}>*/}
      {/*      <tbody>*/}
      {/*        <tr>*/}
      {/*          <th className={style.half}>Latitude</th>*/}
      {/*          <th className={style.half}>Longitude</th>*/}
      {/*        </tr>*/}
      {/*        <tr>*/}
      {/*          <td>*/}
      {/*            <NumberInput*/}
      {/*              value={value.lat}*/}
      {/*              min={-90}*/}
      {/*              max={90}*/}
      {/*              placeholder="0"*/}
      {/*              onChange={(v) => {*/}
      {/*                onChange({ ...value, lat: v });*/}
      {/*              }}*/}
      {/*            />*/}
      {/*          </td>*/}
      {/*          <td>*/}
      {/*            <NumberInput*/}
      {/*              value={value.lon}*/}
      {/*              min={-180}*/}
      {/*              max={180}*/}
      {/*              placeholder="0"*/}
      {/*              onChange={(v) => {*/}
      {/*                onChange({ ...value, lon: v });*/}
      {/*              }}*/}
      {/*            />*/}
      {/*          </td>*/}
      {/*        </tr>*/}
      {/*      </tbody>*/}
      {/*    </table>*/}
      {/*  </div>*/}
      {/*)}*/}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  table: css`
    width: 100%;
    margin-top: 8px;
  `,
  half: css`
    width: 50%;
  `,
}));
