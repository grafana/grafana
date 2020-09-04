import React, { useState, useEffect, useCallback } from 'react';
import { PlotPluginProps } from '../types';
import { usePlotCanvas, usePlotPluginContext } from '../context';
import { pluginLog } from '../utils';

interface Selection {
  min: number;
  max: number;

  // selection bounding box, relative to canvas
  bbox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

interface SelectionPluginAPI {
  selection: Selection;
  clearSelection: () => void;
}

interface SelectionPluginProps extends PlotPluginProps {
  onSelect: (selection: Selection) => void;
  onDismiss?: () => void;
  // when true onSelect won't be fired when selection ends
  // useful for plugins that need to do sth with the selected region, i.e. annotations editor
  lazy?: boolean;
  children?: (api: SelectionPluginAPI) => JSX.Element;
}

export const SelectionPlugin: React.FC<SelectionPluginProps> = ({ onSelect, onDismiss, lazy, id, children }) => {
  const pluginId = `SelectionPlugin:${id}`;
  const pluginsApi = usePlotPluginContext();
  const canvas = usePlotCanvas();

  const [selection, setSelection] = useState<Selection | null>(null);
  //
  useEffect(() => {
    if (!lazy && selection) {
      pluginLog(pluginId, false, 'selected', selection);
      onSelect(selection);
    }
  }, [selection]);
  //
  const clearSelection = useCallback(() => {
    setSelection(null);
  }, [setSelection]);

  useEffect(() => {
    pluginsApi.registerPlugin({
      id: pluginId,
      hooks: {
        setSelect: u => {
          const min = u.posToVal(u.select.left, 'x');
          const max = u.posToVal(u.select.left + u.select.width, 'x');

          setSelection({
            min,
            max,
            bbox: {
              left: u.ctx.canvas.left + u.select.left,
              top: u.ctx.canvas.top,
              height: u.ctx.canvas.height,
              width: u.select.width,
            },
          });
        },
      },
    });

    return () => {
      if (onDismiss) {
        onDismiss();
      }
    };
  }, []);

  if (!children || !canvas || !selection) {
    return null;
  }

  return children({
    selection,
    clearSelection,
  });
};
