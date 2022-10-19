import { css } from '@emotion/css';
import uFuzzy from '@leeoniya/ufuzzy';
import { View } from 'ol';
import Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, FilterInput, IconButton, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { COUNTRIES_GAZETTEER_PATH } from 'app/features/geo/gazetteer/gazetteer';

type Props = {
  map: Map;
};

interface Location {
  latitude: number;
  longitude: number;
}

interface SearchResult {
  resultString: string;
  location: Location;
}

export const SearchOverlay = ({ map }: Props) => {
  const searchStyle = getStyles(config.theme2);
  // TODO expand to select gazette source, or search all available

  // Menu State Management
  const [menuActive, setMenuActive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [data, setData] = useState<string[]>([]);
  const [dataLocations, setDataLocations] = useState<Location[]>([]);
  const [searchResult, setSearchResult] = useState<SearchResult[]>([]);

  function toggleMenu() {
    setMenuActive(!menuActive);
  }

  // Update view when a result is clicked
  function clickResult(i: number) {
    const view = new View({
      center: fromLonLat([searchResult[i].location.longitude, searchResult[i].location.latitude]),
      zoom: 4, // TODO make zoom more intelligent, maybe?
      showFullExtent: true,
    });

    if (map && view) {
      map.setView(view);
    }
  }

  // Get data ready on initial load
  useEffect(() => {
    getBackendSrv()
      .get(COUNTRIES_GAZETTEER_PATH)
      .then((val) => {
        const equivalentArray: string[] = [];
        const locationArray: Location[] = [];
        for (let i = 0; i < val.length; i++) {
          const entry = val[i];
          let entryString = entry.name;
          if (entry.key) {
            entryString += ',' + entry.key;
          }
          if (entry.keys) {
            for (let k = 0; k < val[i].keys.length; k++) {
              entryString += ',' + val[i].keys[k];
            }
          }
          equivalentArray.push(entryString);
          locationArray.push({ latitude: entry.latitude, longitude: entry.longitude });
        }
        setData(equivalentArray);
        setDataLocations(locationArray);
      });
  }, []);

  // Search when query changes
  useEffect(() => {
    // Ignore short searches
    if (searchQuery.length < 2) {
      setSearchResult([]);
      return;
    }
    let uf = new uFuzzy({});
    let idxs = uf.filter(data, searchQuery);
    let info = uf.info(idxs, data, searchQuery);
    let order = uf.sort(info, data, searchQuery);
    const result: SearchResult[] = [];
    for (let i = 0; i < order.length; i++) {
      const dataIdx = idxs[order[i]];
      const dataStringArray = data[dataIdx].split(',');
      const dataStringArrayLength = dataStringArray.length;
      let dataString = dataStringArray[0];
      let dataStringSuff = '';
      if (dataStringArrayLength > 1) {
        for (let a = 1; a < dataStringArrayLength; a++) {
          dataStringSuff += dataStringArray[a] + ', ';
        }
        dataStringSuff = dataStringSuff.slice(0, -2);
        dataString += ` (${dataStringSuff})`;
      }
      result.push({ resultString: dataString, location: dataLocations[dataIdx] });
    }
    setSearchResult(result);
  }, [searchQuery, data, dataLocations]);

  // TODO component for search result list
  return (
    <div className={`${searchStyle.infoWrap} ${!menuActive ? searchStyle.infoWrapClosed : null}`}>
      {menuActive ? (
        <div>
          <div className={searchStyle.rowGroup}>
            <FilterInput
              value={searchQuery}
              onChange={setSearchQuery}
              autoFocus={true}
              placeholder="Search for country..."
            />
            <Button className={searchStyle.button} icon="times" variant="secondary" size="sm" onClick={toggleMenu} />
          </div>
          <div className={searchStyle.resultGroup}>
            {searchResult.map((res, i) => {
              return (
                <div
                  className={searchStyle.result}
                  key={`searchResult${i}`}
                  onClick={() => {
                    clickResult(i);
                  }}
                >
                  {res.resultString}
                </div>
              );
            })}
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
  result: css`
    cursor: pointer;
    &:hover {
      color: ${theme.colors.primary.main};
    }
  `,
  resultGroup: css`
    max-height: 100px;
    overflow: scroll;
  `,
  rowGroup: css`
    display: flex;
    font-size: 10px;
    justify-content: flex-end;
  `,
}));
