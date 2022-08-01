import { css } from '@emotion/css';
import Map from 'ol/Map';
import React, { useMemo, useState } from 'react';
import tinycolor from 'tinycolor2';

import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { Button, IconButton, RadioButtonGroup, Select, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';

import { MapMeasure, MapMeasureOptions, measures } from '../utils/measure';

import { MeasureVectorLayer } from './MeasureVectorLayer';

type Props = {
  map: Map;
  menuActiveState: (value: boolean) => void;
};
// TODO change to useRef
const vector = new MeasureVectorLayer();

export const MeasureOverlay = ({ map, menuActiveState }: Props) => {
  const measureStyle = getStyles(config.theme);

  // Menu State Management
  const [firstLoad, setFirstLoad] = useState<boolean>(true);
  const [menuActive, setMenuActive] = useState<boolean>(false);

  // Options State
  const [options, setOptions] = useState<MapMeasureOptions>({
    action: measures[0].value!,
    unit: measures[0].units[0].value!,
  });
  const unit = useMemo(() => {
    const action = measures.find((m: MapMeasure) => m.value === options.action) ?? measures[0];
    const current = action.getUnit(options.unit);
    vector.setOptions(options);
    return {
      current,
      options: action.units,
    };
  }, [options]);

  const clearPrevious = true;
  const showSegments = false;

  function toggleMenu() {
    setMenuActive(!menuActive);
    // Lift menu state
    // TODO: consolidate into one state
    menuActiveState(!menuActive);
    if (menuActive) {
      map.removeInteraction(vector.draw);
      vector.setVisible(false);
    } else {
      if (firstLoad) {
        // Initialize on first load
        setFirstLoad(false);
        map.addLayer(vector);
        map.addInteraction(vector.modify);
      }
      vector.setVisible(true);
      map.removeInteraction(vector.draw); // Remove last interaction
      const a = measures.find((v: MapMeasure) => v.value === options.action) ?? measures[0];
      vector.addInteraction(map, a.geometry, showSegments, clearPrevious);
    }
  }

  return (
    <div
      className={`${measureStyle.infoWrap} ${!menuActive ? measureStyle.infoWrapClosed : null}`}
      style={{ backgroundColor: '#22252b' }}
    >
      {menuActive ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <RadioButtonGroup
              value={options.action}
              options={measures}
              size="md"
              fullWidth={false}
              onChange={(e: string) => {
                map.removeInteraction(vector.draw);
                const m = measures.find((v: MapMeasure) => v.value === e) ?? measures[0];
                const unit = m.getUnit(options.unit);
                setOptions({ ...options, action: m.value!, unit: unit.value! });
                vector.addInteraction(map, m.geometry, showSegments, clearPrevious);
              }}
            />
            <Button style={{ marginLeft: 'auto' }} icon="times" variant="secondary" size="sm" onClick={toggleMenu} />
          </div>
          <Select
            className={measureStyle.unitSelect}
            value={unit.current}
            options={unit.options}
            isSearchable={false}
            onChange={(v: SelectableValue<string>) => {
              const a = measures.find((v: SelectableValue<string>) => v.value === options.action) ?? measures[0];
              const unit = a.getUnit(v.value) ?? a.units[0];
              setOptions({ ...options, unit: unit.value! });
            }}
          />
        </div>
      ) : (
        <IconButton
          className={measureStyle.icon}
          name="ruler-combined"
          tooltip="show measure tools"
          tooltipPlacement="left"
          onClick={toggleMenu}
        />
      )}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  icon: css`
    background-color: rgba(204, 204, 220, 0.16);
    display: inline-block;
    height: 19.25px;
    margin: 1px;
    width: 19.25px;
  `,
  infoWrap: css`
    color: ${theme.colors.text};
    background: ${tinycolor(theme.colors.panelBg).setAlpha(0.7).toString()};
    border-radius: 4px;
    padding: 2px;
  `,
  infoWrapClosed: css`
    height: 25.25px;
    width: 25.25px;
  `,
  unitSelect: css`
    min-width: 200px;
  `,
}));
