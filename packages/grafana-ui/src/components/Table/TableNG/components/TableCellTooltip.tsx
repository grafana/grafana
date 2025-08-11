import { CSSProperties, ReactElement, SyntheticEvent, useMemo, useState } from 'react';

import { ActionModel, DataFrame, Field, GrafanaTheme2 } from '@grafana/data';
import { TableCellTooltipPlacement } from '@grafana/schema';

import { getPortalContainer } from '../../../Portal/Portal';
import { Popover } from '../../../Tooltip/Popover';
import { PopoverController } from '../../../Tooltip/PopoverController';
import { TableCellOptions } from '../../types';
import { TABLE } from '../constants';
import { TableCellRenderer, TableCellRendererProps } from '../types';

export interface Props {
  cellOptions: TableCellOptions;
  children: ReactElement;
  className?: string;
  data: DataFrame;
  disableSanitizeHtml?: boolean;
  field: Field;
  getActions: (field: Field, rowIdx: number) => ActionModel[];
  height?: number;
  placement?: TableCellTooltipPlacement;
  popoverRef: React.MutableRefObject<HTMLElement | null>;
  renderer: TableCellRenderer;
  rowIdx: number;
  style?: CSSProperties;
  theme: GrafanaTheme2;
  tooltipCaretClassName: string;
  tooltipWrapperClass: string;
  width?: number;
}

export function TableCellTooltip({
  cellOptions,
  children,
  className,
  data,
  disableSanitizeHtml,
  field,
  getActions,
  height: _height,
  placement,
  popoverRef,
  renderer,
  rowIdx,
  style,
  theme,
  tooltipCaretClassName,
  tooltipWrapperClass,
  width = 300,
}: Props) {
  const rawValue = field.values[rowIdx];
  const height = _height ?? TABLE.MAX_CELL_HEIGHT;

  const [pinned, setPinned] = useState(false);

  const rendererProps = useMemo(
    () =>
      ({
        cellInspect: false,
        cellOptions,
        disableSanitizeHtml,
        field,
        frame: data,
        getActions,
        height,
        rowIdx,
        showFilters: false,
        theme,
        value: rawValue,
        width,
      }) satisfies TableCellRendererProps,
    [cellOptions, data, disableSanitizeHtml, field, getActions, height, rawValue, rowIdx, theme, width]
  );

  console.log(popoverRef);

  if (rawValue === null || rawValue === undefined) {
    return children;
  }

  return (
    <PopoverController content={<>{renderer(rendererProps)}</>} placement={placement}>
      {(_showPopper, _hidePopper, popperProps) => {
        const showPopper = () => {
          _showPopper();
        };

        const hidePopper = () => {
          if (!pinned) {
            _hidePopper();
          }
        };

        const unpinPopper = () => {
          setPinned(false);
          _hidePopper();
        };

        const pinPopper = (origEvent: SyntheticEvent) => {
          setPinned(true);
          _showPopper();

          const origTarget = origEvent.currentTarget;

          const listener = (event: MouseEvent) => {
            const clickTarget = event.target as Node;
            if (!origTarget.contains(clickTarget) && !getPortalContainer().contains(clickTarget)) {
              console.log('unpinning');
              unpinPopper();
              window.removeEventListener('click', listener);
            }
          };

          window.addEventListener('click', listener);
        };

        return (
          <>
            {popoverRef.current && (
              <Popover
                {...popperProps}
                wrapperClassName={tooltipWrapperClass}
                className={className}
                style={{ ...style, width, height }}
                referenceElement={popoverRef.current}
                onMouseLeave={hidePopper}
                onMouseEnter={showPopper}
              />
            )}

            {/* TODO figure out how we would make this accessible */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
              className={tooltipCaretClassName}
              style={{ backgroundColor: pinned ? theme.colors.info.transparent : undefined }}
              onMouseEnter={showPopper}
              onMouseLeave={hidePopper}
              onClick={pinned ? unpinPopper : pinPopper}
              onFocus={showPopper}
              onBlur={hidePopper}
            />

            {children}
          </>
        );
      }}
    </PopoverController>
  );
}
