import { cartoLayers, carto } from './carto';
import { esriLayers } from './esri';
import { genericLayers } from './generic';
import { osmLayers } from './osm';
import { provision } from './provision';

const settings = (window as any).grafanaBootData.settings;

// For now just use carto
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
