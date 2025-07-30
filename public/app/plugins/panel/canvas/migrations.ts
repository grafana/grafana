import { PanelModel, OneClickMode } from '@grafana/data';

import { Options } from './panelcfg.gen';

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
          }
        }
      }
    }
  }

  return panel.options;
};
