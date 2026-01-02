import { PanelModel, OneClickMode } from '@grafana/data';
import { PositionDimensionMode, ScalarDimensionMode } from '@grafana/schema';

import { Options } from './panelcfg.gen';

// Helper to migrate a position value from number to PositionDimensionConfig
const migratePositionValue = (value: number | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  return {
    fixed: value,
    mode: PositionDimensionMode.Fixed,
  };
};

export const canvasMigrationHandler = (panel: PanelModel): Partial<Options> => {
  const pluginVersion = panel?.pluginVersion ?? '';

  // Rename text-box to rectangle
  // Initial plugin version is empty string for first migration
  if (pluginVersion === '') {
    const root = panel.options?.root;
    if (root?.elements) {
      for (const element of root.elements) {
        if (element.type === 'text-box') {
          element.type = 'rectangle';
        }
      }
    }
  }

  if (pluginVersion.startsWith('11.0')) {
    // Migration for v11.0 for ellipse element refactor: https://github.com/grafana/grafana/pull/84205
    const root = panel.options?.root;
    if (root?.elements) {
      for (const element of root.elements) {
        if (element.type === 'ellipse') {
          // Take existing ellipse specific background and border config and apply it to the element's general background and border config
          if (element.config.backgroundColor) {
            element.background = element.config.backgroundColor;
            delete element.config.backgroundColor;
          }
          if (element.config.borderColor) {
            element.border.color = element.config.borderColor;
            delete element.config.borderColor;
          }
          if (element.config.width) {
            element.border.width = element.config.width;
            delete element.config.width;
          }
        }
      }
    }
  }

  if (parseFloat(pluginVersion) <= 11.3) {
    const root = panel.options?.root;
    if (root?.elements) {
      for (const element of root.elements) {
        // migrate action options to new format (fetch)
        if (element.actions) {
          for (const action of element.actions) {
            if (action.options) {
              action.fetch = { ...action.options };
              delete action.options;
            }
          }
        }
      }
    }
  }

  // migrate oneClickMode to first link/action oneClick
  if (parseFloat(pluginVersion) <= 11.6) {
    const root = panel.options?.root;
    if (root?.elements) {
      for (const element of root.elements) {
        if ((element.oneClickMode === OneClickMode.Link || element.oneClickLinks) && element.links?.length) {
          element.links[0].oneClick = true;
        } else if (element.oneClickMode === OneClickMode.Action && element.actions?.length) {
          element.actions[0].oneClick = true;
        }

        delete element.oneClickMode;
        delete element.oneClickLinks;
      }
    }
  }

  // migrate connection direction
  if (parseFloat(pluginVersion) <= 12.2) {
    const root = panel.options?.root;
    if (root?.elements) {
      for (const element of root.elements) {
        for (const connection of element.connections || []) {
          if (connection.direction && typeof connection.direction === 'string') {
            // convert old direction to new format
            connection.direction = {
              mode: 'fixed',
              fixed: connection.direction,
            };
          } else if (!connection.direction) {
            connection.direction = {
              mode: 'fixed',
              fixed: 'forward',
            };
          }
        }
      }
    }
  }

  // migrate placement values from numbers to dimension configs
  if (parseFloat(pluginVersion) <= 12.4) {
    const root = panel.options?.root;
    if (root?.elements) {
      for (const element of root.elements) {
        if (element.placement) {
          // Migrate rotation from number to ScalarDimensionConfig
          if (typeof element.placement.rotation === 'number') {
            element.placement.rotation = {
              fixed: element.placement.rotation,
              min: 0,
              max: 360,
              mode: ScalarDimensionMode.Clamped,
            };
          } else if (!element.placement.rotation) {
            element.placement.rotation = {
              fixed: 0,
              min: 0,
              max: 360,
              mode: ScalarDimensionMode.Clamped,
            };
          }

          // Migrate position values from numbers to PositionDimensionConfig
          if (typeof element.placement.top === 'number') {
            element.placement.top = migratePositionValue(element.placement.top);
          }
          if (typeof element.placement.left === 'number') {
            element.placement.left = migratePositionValue(element.placement.left);
          }
          if (typeof element.placement.width === 'number') {
            element.placement.width = migratePositionValue(element.placement.width);
          }
          if (typeof element.placement.height === 'number') {
            element.placement.height = migratePositionValue(element.placement.height);
          }
          if (typeof element.placement.right === 'number') {
            element.placement.right = migratePositionValue(element.placement.right);
          }
          if (typeof element.placement.bottom === 'number') {
            element.placement.bottom = migratePositionValue(element.placement.bottom);
          }
        }
      }
    }
  }

  return panel.options;
};
