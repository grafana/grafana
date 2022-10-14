import { css } from '@emotion/css';
import { View } from 'ol';
import Map from 'ol/Map';
import React, { useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, FilterInput, IconButton, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { COUNTRIES_GAZETTEER_PATH, getGazetteer } from 'app/features/geo/gazetteer/gazetteer';

type Props = {
  map: Map;
};

export const SearchOverlay = ({ map }: Props) => {
  const searchStyle = getStyles(config.theme2);
  // TODO expand to select gazette source, or search all available
  const gaz = getGazetteer(COUNTRIES_GAZETTEER_PATH);

  // Menu State Management
  const [menuActive, setMenuActive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const searchRef = useRef<HTMLInputElement | null>(null);

  function toggleMenu() {
    setMenuActive(!menuActive);
  }

  useEffect(() => {
    const searchLocation = async () => {
      const searchResult = (await gaz).find(searchQuery)?.point()?.getCoordinates();
      if (searchResult) {
        const view = new View({
          center: searchResult,
          zoom: 4, // TODO make zoom more intelligent, maybe?
          showFullExtent: true,
        });

        if (map && view) {
          map.setView(view);
        }
      }
    };
    searchLocation();
  }, [searchQuery, gaz, map]);

  // TODO add search result list to select from
  return (
    <div className={`${searchStyle.infoWrap} ${!menuActive ? searchStyle.infoWrapClosed : null}`}>
      {menuActive ? (
        <div>
          <div className={searchStyle.rowGroup}>
            <FilterInput
              value={searchQuery}
              onChange={setSearchQuery}
              ref={searchRef}
              autoFocus={true}
              placeholder="Search for..."
              style={{ fontSize: '10px' }}
            />
            <Button className={searchStyle.button} icon="times" variant="secondary" size="sm" onClick={toggleMenu} />
          </div>
        </div>
      ) : (
        <IconButton
          className={searchStyle.icon}
          name="search"
          tooltip="show search"
          tooltipPlacement="right"
          onClick={toggleMenu}
        />
      )}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  button: css`
    margin-left: auto;
  `,
  icon: css`
    background-color: ${theme.colors.secondary.main};
    display: inline-block;
    height: 19.25px;
    margin: 1px;
    padding-top: 1px;
    width: 19.25px;
  `,
  infoWrap: css`
    color: ${theme.colors.text};
    background-color: ${theme.colors.background.secondary};
    border-radius: 4px;
    padding: 2px;
  `,
  infoWrapClosed: css`
    height: 25.25px;
    width: 25.25px;
  `,
  rowGroup: css`
    display: flex;
    justify-content: flex-end;
  `,
  unitSelect: css`
    min-width: 200px;
  `,
}));
