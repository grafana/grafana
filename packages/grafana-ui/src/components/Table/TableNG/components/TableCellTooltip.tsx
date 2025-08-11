import { CSSProperties, ReactElement, SyntheticEvent, useMemo, useState, useRef } from 'react';

import { ActionModel, DataFrame, Field, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TableCellTooltipPlacement } from '@grafana/schema';

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
  root?: HTMLElement;
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
  root,
  rowIdx,
  style,
  theme,
  tooltipCaretClassName,
  tooltipWrapperClass,
  width = 300,
}: Props) {
  const rawValue = field.values[rowIdx];
  const height = _height ?? TABLE.MAX_CELL_HEIGHT;
  const tooltipContentRef = useRef<HTMLDivElement>(null);

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

  if (rawValue === null || rawValue === undefined) {
    return children;
  }

  const body = (
    <div ref={tooltipContentRef} data-testid={selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper}>
      {renderer(rendererProps)}
    </div>
  );

  return (
    <PopoverController content={body} placement={placement}>
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
          console.log('unpin');
          setPinned(false);
          _hidePopper();
        };

        const pinPopper = (origEvent: SyntheticEvent) => {
          setPinned(true);
          _showPopper();

          const origTarget = origEvent.currentTarget;

          const listener = (event: MouseEvent) => {
            const clickTarget = event.target as Node;
            if (!origTarget.contains(clickTarget) && !tooltipContentRef.current?.contains(clickTarget)) {
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
                root={root}
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
              data-testid={selectors.components.Panels.Visualization.TableNG.Tooltip.Caret}
              aria-pressed={pinned}
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
