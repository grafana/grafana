import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { css as cssCore, Global } from '@emotion/react';
import {
  ContextMenu,
  GraphContextMenuHeader,
  IconName,
  MenuItemProps,
  MenuItemsGroup,
  MenuGroup,
  MenuItem,
  UPlotConfigBuilder,
} from '@grafana/ui';
import { CartesianCoords2D, DataFrame, getFieldDisplayName, InterpolateFunction, TimeZone } from '@grafana/data';
import { useClickAway } from 'react-use';
import { pluginLog } from '@grafana/ui/src/components/uPlot/utils';

interface ContextMenuPluginProps {
  data: DataFrame;
  config: UPlotConfigBuilder;
  defaultItems?: MenuItemsGroup[];
  timeZone: TimeZone;
  onOpen?: () => void;
  onClose?: () => void;
  replaceVariables?: InterpolateFunction;
}

export const ContextMenuPlugin: React.FC<ContextMenuPluginProps> = ({
  data,
  config,
  defaultItems,
  onClose,
  timeZone,
  replaceVariables,
}) => {
  const plotCanvas = useRef<HTMLDivElement>();
  const plotCanvasBBox = useRef<any>({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
  const [coords, setCoords] = useState<{ viewport: CartesianCoords2D; plotCanvas: CartesianCoords2D } | null>(null);
  const [point, setPoint] = useState<{ seriesIdx: number | null; dataIdx: number | null } | null>();
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
    const onMouseCapture = (e: MouseEvent) => {
      setCoords({
        plotCanvas: {
          x: e.clientX - plotCanvasBBox.current.left,
          y: e.clientY - plotCanvasBBox.current.top,
        },
        viewport: {
          x: e.clientX,
          y: e.clientY,
        },
      });
    };

    config.addHook('init', (u) => {
      const canvas = u.over;
      plotCanvas.current = canvas || undefined;
      plotCanvas.current?.addEventListener('mousedown', onMouseCapture);
      plotCanvas.current?.addEventListener('mouseleave', () => {});

      pluginLog('ContextMenuPlugin', false, 'init');
      // for naive click&drag check
      let isClick = false;

      // REF: https://github.com/leeoniya/uPlot/issues/239
      let pts = Array.from(u.root.querySelectorAll<HTMLDivElement>('.u-cursor-pt'));

      plotCanvas.current?.addEventListener('mousedown', (e: MouseEvent) => {
        isClick = true;
      });
      plotCanvas.current?.addEventListener('mousemove', (e: MouseEvent) => {
        isClick = false;
      });

      // TODO: remove listeners on unmount
      plotCanvas.current?.addEventListener('mouseup', (e: MouseEvent) => {
        if (!isClick) {
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
      });

      if (pts.length > 0) {
        pts.forEach((pt, i) => {
          // TODO: remove listeners on unmount
          pt.addEventListener('click', (e) => {
            const seriesIdx = i + 1;
            const dataIdx = u.cursor.idx;
            pluginLog('ContextMenuPlugin', false, seriesIdx, dataIdx);
            openMenu();
            setPoint({ seriesIdx, dataIdx: dataIdx || null });
          });
        });
      }
    });
  }, [config, openMenu]);

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

interface ContextMenuProps {
  data: DataFrame;
  defaultItems?: MenuItemsGroup[];
  timeZone: TimeZone;
  onClose?: () => void;
  selection: {
    point?: { seriesIdx: number | null; dataIdx: number | null } | null;
    coords: { plotCanvas: CartesianCoords2D; viewport: CartesianCoords2D };
  };
  replaceVariables?: InterpolateFunction;
}

export const ContextMenuView: React.FC<ContextMenuProps> = ({
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

    if (seriesIdx && dataIdx) {
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
                  icon: `${link.target === '_self' ? 'link' : 'external-link-alt'}` as IconName,
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
          displayName={getFieldDisplayName(field, data)}
        />
      );
    }
  }

  const renderMenuGroupItems = () => {
    return items?.map((group, index) => (
      <MenuGroup key={`${group.label}${index}`} label={group.label} ariaLabel={group.label}>
        {(group.items || []).map((item) => (
          <MenuItem
            key={item.label}
            url={item.url}
            label={item.label}
            ariaLabel={item.label}
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
