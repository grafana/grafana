import { type Map as OlMap } from 'ol';
import { type Coordinate } from 'ol/coordinate';
import { toLonLat, transformExtent } from 'ol/proj';
import React, { useState, useEffect } from 'react';

import { Input, Button, Stack, useTheme2, IconButton, Tooltip, Icon } from '@grafana/ui';

import { type MapViewConfig } from '../types';
import { MapCenterID } from '../view';

interface NominatimResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: string[];
}

interface LocationSearchProps {
  map?: OlMap;
  onChange: (value: MapViewConfig) => void;
  value: MapViewConfig;
}

export const LocationSearch: React.FC<LocationSearchProps> = ({ map, onChange, value }) => {
  const theme = useTheme2();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [originalCenter, setOriginalCenter] = useState<Coordinate | null>(null);
  const [originalZoom, setOriginalZoom] = useState<number | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<Coordinate | null>(null);
  const [selectedZoom, setSelectedZoom] = useState<number | null>(null);
  const [revertTimeout, setRevertTimeout] = useState<number | null>(null);
  const [isPermanentlySelected, setIsPermanentlySelected] = useState(false);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);

  useEffect(() => {
    setOriginalCenter(null);
    setOriginalZoom(null);
    setSelectedCenter(null);
    setSelectedZoom(null);
    setIsPermanentlySelected(false);
  }, [searchResults]);

  const performSearch = async () => {
    if (!searchQuery) {
      return;
    }
    setIsSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Grafana Geomap Panel',
        },
      });
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching location:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const previewLocation = (result: NominatimResult) => {
    if (!map) {
      return;
    }
    const view = map.getView();

    if (originalCenter === null) {
      const currentCenter = view.getCenter();
      const currentZoom = view.getZoom();
      if (currentCenter) {
        setOriginalCenter(currentCenter);
      }
      if (currentZoom !== undefined) {
        setOriginalZoom(currentZoom);
      }
    }

    if (revertTimeout) {
      clearTimeout(revertTimeout);
      setRevertTimeout(null);
    }

    const bb = result.boundingbox.map(Number);
    const extent = transformExtent([bb[2], bb[0], bb[3], bb[1]], 'EPSG:4326', 'EPSG:3857');
    view.fit(extent, { padding: [170, 50, 30, 50], maxZoom: 18, duration: 0 });
  };

  const selectLocation = (result: NominatimResult) => {
    previewLocation(result);
    setIsPermanentlySelected(true);
    if (map) {
      const view = map.getView();
      const coords = view.getCenter();
      if (coords) {
        const center = toLonLat(coords, view.getProjection());
        onChange({
          ...value,
          id: MapCenterID.Coordinates,
          lon: +center[0].toFixed(6),
          lat: +center[1].toFixed(6),
          zoom: +view.getZoom()!.toFixed(2),
        });
        const centerAfter = view.getCenter();
        const zoomAfter = view.getZoom();
        if (centerAfter) {
          setSelectedCenter(centerAfter);
        }
        if (zoomAfter !== undefined) {
          setSelectedZoom(zoomAfter);
        }
      }
    }
    setSelectedResult(result.place_id);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: theme.spacing(1) }}>
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          placeholder="Search for a location"
          disabled={isSearching}
          suffix={
            searchQuery && (
              <IconButton
                name="times"
                tooltip="Clear"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              />
            )
          }
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              performSearch();
            }
          }}
          style={{ flexGrow: 1, marginRight: theme.spacing(1) }}
        />
        <Button onClick={performSearch} disabled={isSearching || !searchQuery}>
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
        <Tooltip
          content={
            <div>
              Powered by{' '}
              <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer">
                Nominatim
              </a>
              . Data ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                OpenStreetMap contributors
              </a>
              .
            </div>
          }
        >
          <a
            href="https://nominatim.openstreetmap.org/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: theme.spacing(1), cursor: 'pointer' }}
          >
            <Icon name="info-circle" />
          </a>
        </Tooltip>
      </div>
      {searchResults.length > 0 && (
        <div
          style={{
            maxHeight: '200px',
            overflow: 'auto',
            background: theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border.weak}`,
            borderRadius: theme.shape.borderRadius(),
            marginTop: theme.spacing(1),
          }}
          onMouseLeave={() => {
            if (revertTimeout) {
              clearTimeout(revertTimeout);
            }
            const timeout = window.setTimeout(() => {
              if (map) {
                const view = map.getView();
                if (isPermanentlySelected && selectedCenter && selectedZoom) {
                  view.setCenter(selectedCenter);
                  view.setZoom(selectedZoom);
                } else if (originalCenter && originalZoom) {
                  view.setCenter(originalCenter);
                  view.setZoom(originalZoom);
                }
              }
              setRevertTimeout(null);
            }, 150);
            setRevertTimeout(timeout);
          }}
        >
          <Stack direction="column" gap={0}>
            {searchResults.map((result) => (
              <div
                key={result.place_id}
                onMouseEnter={() => previewLocation(result)}
                onClick={() => selectLocation(result)}
                style={{
                  cursor: 'pointer',
                  padding: theme.spacing(1),
                  borderBottom: `1px solid ${theme.colors.border.weak}`,
                  background: result.place_id === selectedResult ? theme.colors.primary.shade : 'none',
                }}
                onMouseOver={(e: React.MouseEvent<HTMLDivElement>) => {
                  e.currentTarget.style.background = theme.colors.action.hover;
                }}
                onMouseOut={(e: React.MouseEvent<HTMLDivElement>) => {
                  e.currentTarget.style.background =
                    result.place_id === selectedResult ? theme.colors.primary.shade : 'none';
                }}
              >
                {result.display_name}
              </div>
            ))}
          </Stack>
        </div>
      )}
    </>
  );
};
