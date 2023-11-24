import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
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

export const ContextMenuPlugin = ({
  data,
  config,
  onClose,
  timeZone,
  replaceVariables,
  ...otherProps
}: ContextMenuPluginProps) => {
  const [coords, setCoords] = useState<ContextMenuSelectionCoords | null>(null);
  const [point, setPoint] = useState<ContextMenuSelectionPoint | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useLayoutEffect(() => {
    let seriesIdx: number | null = null;

    config.addHook('init', (u) => {
      u.over.addEventListener('click', (e) => {
        // only open when have a focused point, and not for explicit annotations, zooms, etc.
        if (seriesIdx != null && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
          setCoords({
            viewport: {
              x: e.clientX,
              y: e.clientY,
            },
            plotCanvas: {
              x: e.clientX - u.rect.left,
              y: e.clientY - u.rect.top,
            },
          });
          setPoint({ seriesIdx, dataIdx: u.cursor.idxs![seriesIdx] });
          setIsOpen(true);
        }
      });
    });

    config.addHook('setSeries', (u, _seriesIdx) => {
      seriesIdx = _seriesIdx;
    });
  }, [config]);

  const defaultItems = useMemo(() => {
    return otherProps.defaultItems
      ? otherProps.defaultItems.map((i) => {
          return {
            ...i,
            items: i.items.map((j) => {
              return {
                ...j,
                onClick: (e: React.MouseEvent<HTMLElement>) => {
                  if (!coords) {
                    return;
                  }

                  j.onClick?.(e, { coords });
                },
              };
            }),
          };
        })
      : [];
  }, [coords, otherProps.defaultItems]);

  return (
    <>
      {isOpen && coords && (
        <ContextMenuView
          data={data}
          frames={otherProps.frames}
          defaultItems={defaultItems}
          timeZone={timeZone}
          selection={{ point, coords }}
          replaceVariables={replaceVariables}
          onClose={() => {
            setPoint(null);
            setIsOpen(false);
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

export const ContextMenuView = ({
  selection,
  timeZone,
  defaultItems,
  replaceVariables,
  data,
  ...otherProps
}: ContextMenuViewProps) => {
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

      const displayValue = field.display!(field.values[dataIdx]);

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
          timestamp={xFieldFmt(xField.values[dataIdx]).text}
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
            key={item.url}
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
