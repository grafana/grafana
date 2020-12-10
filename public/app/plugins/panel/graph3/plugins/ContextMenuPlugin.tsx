import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  ClickPlugin,
  ContextMenu,
  GraphContextMenuHeader,
  IconName,
  MenuItem,
  MenuItemsGroup,
  Portal,
  usePlotData,
} from '@grafana/ui';
import {
  DataFrameView,
  DisplayValue,
  Field,
  getDisplayProcessor,
  getFieldDisplayName,
  InterpolateFunction,
} from '@grafana/data';
import { TimeZone } from '@grafana/data';
import { useClickAway } from 'react-use';
import { getFieldLinksSupplier } from '../../../../features/panel/panellinks/linkSuppliers';

interface ContextMenuPluginProps {
  defaultItems?: MenuItemsGroup[];
  timeZone: TimeZone;
  onOpen?: () => void;
  onClose?: () => void;
  replaceVariables?: InterpolateFunction;
}

export const ContextMenuPlugin: React.FC<ContextMenuPluginProps> = ({
  onClose,
  timeZone,
  defaultItems,
  replaceVariables,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const onClick = useCallback(() => {
    setIsOpen(!isOpen);
  }, [setIsOpen]);

  return (
    <ClickPlugin id="ContextMenu" onClick={onClick}>
      {({ point, coords, clearSelection }) => {
        return (
          <Portal>
            <ContextMenuView
              defaultItems={defaultItems}
              timeZone={timeZone}
              selection={{ point, coords }}
              replaceVariables={replaceVariables}
              onClose={() => {
                clearSelection();
                if (onClose) {
                  onClose();
                }
              }}
            />
          </Portal>
        );
      }}
    </ClickPlugin>
  );
};

interface ContextMenuProps {
  defaultItems?: MenuItemsGroup[];
  timeZone: TimeZone;
  onClose?: () => void;
  selection: {
    point: { seriesIdx: number | null; dataIdx: number | null };
    coords: { plotCanvas: { x: number; y: number }; viewport: { x: number; y: number } };
  };
  replaceVariables?: InterpolateFunction;
}

export const ContextMenuView: React.FC<ContextMenuProps> = ({
  selection,
  timeZone,
  defaultItems,
  replaceVariables,
  ...otherProps
}) => {
  const ref = useRef(null);
  const { data } = usePlotData();
  const { seriesIdx, dataIdx } = selection.point;

  const onClose = () => {
    if (otherProps.onClose) {
      otherProps.onClose();
    }
  };

  useClickAway(ref, () => {
    onClose();
  });

  const contextMenuProps = useMemo(() => {
    const items = defaultItems ? [...defaultItems] : [];
    let field: Field;
    let displayValue: DisplayValue;
    const timeField = data.fields[0];
    const timeFormatter = timeField.display || getDisplayProcessor({ field: timeField, timeZone });
    let renderHeader: () => JSX.Element | null = () => null;

    if (seriesIdx && dataIdx) {
      field = data.fields[seriesIdx];
      displayValue = field.display!(field.values.get(dataIdx));
      const hasLinks = field.config.links && field.config.links.length > 0;

      if (hasLinks) {
        const linksSupplier = getFieldLinksSupplier({
          display: displayValue,
          name: field.name,
          view: new DataFrameView(data),
          rowIndex: dataIdx,
          colIndex: seriesIdx,
          field: field.config,
          hasLinks,
        });

        if (linksSupplier) {
          items.push({
            items: linksSupplier.getLinks(replaceVariables).map<MenuItem>(link => {
              return {
                label: link.title,
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
          timestamp={timeFormatter(timeField.values.get(dataIdx)).text}
          displayValue={displayValue}
          seriesColor={displayValue.color!}
          displayName={getFieldDisplayName(field, data)}
        />
      );
    }

    return {
      renderHeader,
      items,
    };
  }, [defaultItems, seriesIdx, dataIdx, data]);

  return (
    <ContextMenu
      {...contextMenuProps}
      x={selection.coords.viewport.x}
      y={selection.coords.viewport.y}
      onClose={onClose}
    />
  );
};
