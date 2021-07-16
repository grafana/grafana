import { cartoLayers, carto } from './carto';
import { esriLayers } from './esri';
import { genericLayers } from './generic';
import { osmLayers } from './osm';
import { provision } from './provision';

const settings = (window as any).grafanaBootData.settings;

// Use CartoDB if the tile server url is not set in defaults.ini
export const defaultGrafanaThemedMap = settings.tileServerURL
  ? {
      ...provision,
      id: 'default',
      name: 'Default base layer',
    }
  : {
      ...carto,
      id: 'default',
      name: 'Default base layer',
    };

/**
 * Registry for layer handlers
 * Remove all other base layers if BaseLayerDisabled is set to true in defaults.ini
 */
export const basemapLayers = settings.BaseLayerDisabled
  ? [defaultGrafanaThemedMap]
  : [
      defaultGrafanaThemedMap,
      ...osmLayers,
      ...cartoLayers,
      ...esriLayers, // keep formatting
      ...genericLayers,
    ];
