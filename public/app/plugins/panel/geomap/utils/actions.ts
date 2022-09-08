import { cloneDeep } from 'lodash';

import { FrameGeometrySourceMode } from '@grafana/data/src';

import { GeomapPanel } from '../GeomapPanel';
import { geomapLayerRegistry } from '../layers/registry';
import { GeomapLayerActions, MapLayerState } from '../types';

import { initLayer } from './layers';
import { getNextLayerName } from './utils';

export const getActions = (panel: GeomapPanel) => {
  const actions: GeomapLayerActions = {
    selectLayer: (uid: string) => {
      const selected = panel.layers.findIndex((v) => v.options.name === uid);
      if (panel.panelContext && panel.panelContext.onInstanceStateChange) {
        panel.panelContext.onInstanceStateChange({
          map: panel.map,
          layers: panel.layers,
          selected,
          actions: panel.actions,
        });
      }
    },
    canRename: (v: string) => {
      return !panel.byName.has(v);
    },
    deleteLayer: (uid: string) => {
      const layers: MapLayerState[] = [];
      for (const lyr of panel.layers) {
        if (lyr.options.name === uid) {
          panel.map?.removeLayer(lyr.layer);
        } else {
          layers.push(lyr);
        }
      }
      panel.layers = layers;
      panel.doOptionsUpdate(0);
    },
    addlayer: (type: string) => {
      const item = geomapLayerRegistry.getIfExists(type);
      if (!item) {
        return; // ignore empty request
      }
      initLayer(
        panel,
        panel.map!,
        {
          type: item.id,
          name: getNextLayerName(panel),
          config: cloneDeep(item.defaultOptions),
          location: item.showLocation ? { mode: FrameGeometrySourceMode.Auto } : undefined,
          tooltip: true,
        },
        false
      ).then((lyr) => {
        panel.layers = panel.layers.slice(0);
        panel.layers.push(lyr);
        panel.map?.addLayer(lyr.layer);

        panel.doOptionsUpdate(panel.layers.length - 1);
      });
    },
    reorder: (startIndex: number, endIndex: number) => {
      const result = Array.from(panel.layers);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      panel.layers = result;

      panel.doOptionsUpdate(endIndex);

      // Add the layers in the right order
      const group = panel.map?.getLayers()!;
      group.clear();
      panel.layers.forEach((v) => group.push(v.layer));
    },
  };

  return actions;
};
