import React, { useCallback, useRef, useState } from 'react';
import {
  ClickPlugin,
  ContextMenu,
  GraphContextMenuHeader,
  IconName,
  MenuItem,
  MenuItemsGroup,
  Portal,
  useGraphNGContext,
} from '@grafana/ui';
import {
  DataFrame,
  DataFrameView,
  getDisplayProcessor,
  getFieldDisplayName,
  InterpolateFunction,
  TimeZone,
} from '@grafana/data';
import { useClickAway } from 'react-use';
import { getFieldLinksSupplier } from '../../../../features/panel/panellinks/linkSuppliers';

interface ContextMenuPluginProps {
  data: DataFrame[];
  defaultItems?: MenuItemsGroup[];
  timeZone: TimeZone;
  onOpen?: () => void;
  onClose?: () => void;
  replaceVariables?: InterpolateFunction;
}

export const ContextMenuPlugin: React.FC<ContextMenuPluginProps> = ({
  data,
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
              data={data}
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
  data: DataFrame[];
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
  data,
  ...otherProps
}) => {
  const ref = useRef(null);
  const graphContext = useGraphNGContext();

  const onClose = () => {
    if (otherProps.onClose) {
      otherProps.onClose();
    }
  };

  useClickAway(ref, () => {
    onClose();
  });

  const xField = graphContext.getXAxisField();

  if (!xField) {
    return null;
  }

  const items = defaultItems ? [...defaultItems] : [];
  let renderHeader: () => JSX.Element | null = () => null;

  const { seriesIdx, dataIdx } = selection.point;
  const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone });

  if (seriesIdx && dataIdx) {
    // origin field/frame indexes for inspecting the data
    const originFieldIndex = graphContext.mapSeriesIndexToDataFrameFieldIndex(seriesIdx);
    const frame = data[originFieldIndex.frameIndex];
    const field = frame.fields[originFieldIndex.fieldIndex];

    const displayValue = field.display!(field.values.get(dataIdx));

    const hasLinks = field.config.links && field.config.links.length > 0;

    if (hasLinks) {
      const linksSupplier = getFieldLinksSupplier({
        display: displayValue,
        name: field.name,
        view: new DataFrameView(frame),
        rowIndex: dataIdx,
        colIndex: originFieldIndex.fieldIndex,
        field: field.config,
        hasLinks,
      });

      if (linksSupplier) {
        items.push({
          items: linksSupplier.getLinks(replaceVariables).map<MenuItem>((link) => {
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
        timestamp={xFieldFmt(xField.values.get(dataIdx)).text}
        displayValue={displayValue}
        seriesColor={displayValue.color!}
        displayName={getFieldDisplayName(field, frame)}
      />
    );
  }

  return (
    <ContextMenu
      items={items}
      renderHeader={renderHeader}
      x={selection.coords.viewport.x}
      y={selection.coords.viewport.y}
      onClose={onClose}
    />
  );
};
