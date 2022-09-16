import { css as cssCore, Global } from '@emotion/react';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useClickAway } from 'react-use';

import { CartesianCoords2D, DataFrame, getFieldDisplayName, InterpolateFunction, TimeZone } from '@grafana/data';
import {
  ContextMenu,
  GraphContextMenuHeader,
  MenuItemProps,
  MenuItemsGroup,
  MenuGroup,
  MenuItem,
  UPlotConfigBuilder,
} from '@grafana/ui';
import { pluginLog } from '@grafana/ui/src/components/uPlot/utils';

type ContextMenuSelectionCoords = { viewport: CartesianCoords2D; plotCanvas: CartesianCoords2D };
type ContextMenuSelectionPoint = { seriesIdx: number | null; dataIdx: number | null };

export interface ContextMenuItemClickPayload {
  coords: ContextMenuSelectionCoords;
}

interface ContextMenuPluginProps {
  data: DataFrame;
  frames?: DataFrame[];
  config: UPlotConfigBuilder;
  defaultItems?: Array<MenuItemsGroup<ContextMenuItemClickPayload>>;
  timeZone: TimeZone;
  onOpen?: () => void;
  onClose?: () => void;
  replaceVariables?: InterpolateFunction;
}

export const ContextMenuPlugin: React.FC<ContextMenuPluginProps> = ({
  data,
  config,
  onClose,
  timeZone,
  replaceVariables,
  ...otherProps
}) => {
  const plotCanvas = useRef<HTMLDivElement>();
  const [coords, setCoords] = useState<ContextMenuSelectionCoords | null>(null);
  const [point, setPoint] = useState<ContextMenuSelectionPoint | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openMenu = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const clearSelection = useCallback(() => {
    pluginLog('ContextMenuPlugin', false, 'clearing click selection');
    setPoint(null);
  }, [setPoint]);

  // Add uPlot hooks to the config, or re-add when the config changed
  useLayoutEffect(() => {
    let bbox: DOMRect | undefined = undefined;

    const onMouseCapture = (e: MouseEvent) => {
      let update = {
        viewport: {
          x: e.clientX,
          y: e.clientY,
        },
        plotCanvas: {
          x: 0,
          y: 0,
        },
      };
      if (bbox) {
        update = {
          ...update,
          plotCanvas: {
            x: e.clientX - bbox.left,
            y: e.clientY - bbox.top,
          },
        };
      }
      setCoords(update);
    };

    // cache uPlot plotting area bounding box
    config.addHook('syncRect', (u, rect) => {
      bbox = rect;
    });

    config.addHook('init', (u) => {
      const canvas = u.over;
      plotCanvas.current = canvas || undefined;
      plotCanvas.current?.addEventListener('mousedown', onMouseCapture);

      pluginLog('ContextMenuPlugin', false, 'init');
      // for naive click&drag check
      let isClick = false;

      // REF: https://github.com/leeoniya/uPlot/issues/239
      let pts = Array.from(u.root.querySelectorAll<HTMLDivElement>('.u-cursor-pt'));

      plotCanvas.current?.addEventListener('mousedown', () => {
        isClick = true;
      });

      plotCanvas.current?.addEventListener('mousemove', () => {
        isClick = false;
      });

      // TODO: remove listeners on unmount
      plotCanvas.current?.addEventListener('mouseup', (e: MouseEvent) => {
        // ignore cmd+click, this is handled by annotation editor
        if (!isClick || e.metaKey || e.ctrlKey) {
          setPoint(null);
          return;
        }
        isClick = true;

        if (e.target) {
          const target = e.target as HTMLElement;
          if (!target.classList.contains('u-cursor-pt')) {
            pluginLog('ContextMenuPlugin', false, 'canvas click');
            setPoint({ seriesIdx: null, dataIdx: null });
          }
        }

        openMenu();
      });

      if (pts.length > 0) {
        pts.forEach((pt, i) => {
          // TODO: remove listeners on unmount
          pt.addEventListener('click', () => {
            const seriesIdx = i + 1;
            const dataIdx = u.cursor.idx;
            pluginLog('ContextMenuPlugin', false, seriesIdx, dataIdx);
            setPoint({ seriesIdx, dataIdx: dataIdx ?? null });
          });
        });
      }
    });
  }, [config, openMenu, setCoords, setPoint]);

  const defaultItems = useMemo(() => {
    return otherProps.defaultItems
      ? otherProps.defaultItems.map((i) => {
          return {
            ...i,
            items: i.items.map((j) => {
              return {
                ...j,
                onClick: (e?: React.SyntheticEvent<HTMLElement>) => {
                  if (!coords) {
                    return;
                  }
                  if (j.onClick) {
                    j.onClick(e, { coords });
                  }
                },
              };
            }),
          };
        })
      : [];
  }, [coords, otherProps.defaultItems]);

  return (
    <>
      <Global
        styles={cssCore`
        .uplot .u-cursor-pt {
          pointer-events: auto !important;
        }
      `}
      />
      {isOpen && coords && (
        <ContextMenuView
          data={data}
          frames={otherProps.frames}
          defaultItems={defaultItems}
          timeZone={timeZone}
          selection={{ point, coords }}
          replaceVariables={replaceVariables}
          onClose={() => {
            clearSelection();
            closeMenu();
            if (onClose) {
              onClose();
            }
          }}
        />
      )}
    </>
  );
};

interface ContextMenuViewProps {
  data: DataFrame;
  frames?: DataFrame[];
  defaultItems?: MenuItemsGroup[];
  timeZone: TimeZone;
  onClose?: () => void;
  selection: {
    point?: { seriesIdx: number | null; dataIdx: number | null } | null;
    coords: { plotCanvas: CartesianCoords2D; viewport: CartesianCoords2D };
  };
  replaceVariables?: InterpolateFunction;
}

export const ContextMenuView: React.FC<ContextMenuViewProps> = ({
  selection,
  timeZone,
  defaultItems,
  replaceVariables,
  data,
  ...otherProps
}) => {
  const ref = useRef(null);

  const onClose = () => {
    if (otherProps.onClose) {
      otherProps.onClose();
    }
  };

  useClickAway(ref, () => {
    onClose();
  });

  const xField = data.fields[0];

  if (!xField) {
    return null;
  }
  const items = defaultItems ? [...defaultItems] : [];
  let renderHeader: () => JSX.Element | null = () => null;

  if (selection.point) {
    const { seriesIdx, dataIdx } = selection.point;
    const xFieldFmt = xField.display!;

    if (seriesIdx && dataIdx !== null) {
      const field = data.fields[seriesIdx];

      const displayValue = field.display!(field.values.get(dataIdx));

      const hasLinks = field.config.links && field.config.links.length > 0;

      if (hasLinks) {
        if (field.getLinks) {
          items.push({
            items: field
              .getLinks({
                valueRowIndex: dataIdx,
              })
              .map<MenuItemProps>((link) => {
                return {
                  label: link.title,
                  ariaLabel: link.title,
                  url: link.href,
                  target: link.target,
                  icon: link.target === '_self' ? 'link' : 'external-link-alt',
                  onClick: link.onClick,
                };
              }),
          });
        }
      }

      // eslint-disable-next-line react/display-name
      renderHeader = () => (
        <GraphContextMenuHeader
          timestamp={xFieldFmt(xField.values.get(dataIdx)).text}
          displayValue={displayValue}
          seriesColor={displayValue.color!}
          displayName={getFieldDisplayName(field, data, otherProps.frames)}
        />
      );
    }
  }

  const renderMenuGroupItems = () => {
    return items?.map((group, index) => (
      <MenuGroup key={`${group.label}${index}`} label={group.label}>
        {(group.items || []).map((item) => (
          <MenuItem
            key={item.label}
            url={item.url}
            label={item.label}
            target={item.target}
            icon={item.icon}
            active={item.active}
            onClick={item.onClick}
          />
        ))}
      </MenuGroup>
    ));
  };

  return (
    <ContextMenu
      renderMenuItems={renderMenuGroupItems}
      renderHeader={renderHeader}
      x={selection.coords.viewport.x}
      y={selection.coords.viewport.y}
      onClose={onClose}
    />
  );
};
