import { CSSProperties, ReactElement, useMemo, useState, useRef, useEffect, RefObject } from 'react';
import { DataGridHandle } from 'react-data-grid';

import { ActionModel, DataFrame, Field, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TableCellTooltipPlacement } from '@grafana/schema';

import { Popover } from '../../../Tooltip/Popover';
import { TableCellOptions } from '../../types';
import { getTooltipStyles } from '../styles';
import { TableCellRenderer, TableCellRendererProps } from '../types';

export interface Props {
  cellOptions: TableCellOptions;
  children: ReactElement;
  classes: ReturnType<typeof getTooltipStyles>;
  className?: string;
  data: DataFrame;
  disableSanitizeHtml?: boolean;
  field: Field;
  getActions: (field: Field, rowIdx: number) => ActionModel[];
  gridRef: RefObject<DataGridHandle>;
  height: number;
  placement?: TableCellTooltipPlacement;
  popoverRef: React.MutableRefObject<HTMLElement | null>;
  renderer: TableCellRenderer;
  rowIdx: number;
  style?: CSSProperties;
  tooltipField: Field;
  theme: GrafanaTheme2;
  width?: number;
}

export function TableCellTooltip({
  cellOptions,
  children,
  classes,
  className,
  data,
  disableSanitizeHtml,
  field,
  getActions,
  gridRef,
  height,
  placement,
  popoverRef,
  renderer,
  rowIdx,
  style,
  theme,
  tooltipField,
  width = 300,
}: Props) {
  const rawValue = field.values[rowIdx];
  const tooltipCaretRef = useRef<HTMLDivElement>(null);

  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  const show = hovered || pinned;
  const dynamicHeight = tooltipField.config.custom?.cellOptions?.dynamicHeight;

  useEffect(() => {
    if (pinned) {
      const gridRoot = gridRef.current?.element;

      const windowListener = (ev: Event) => {
        if (ev.target === tooltipCaretRef.current) {
          return;
        }

        setPinned(false);
        window.removeEventListener('click', windowListener);
      };

      window.addEventListener('click', windowListener);

      // right now, we kill the pinned tooltip on any form of scrolling to avoid awkward rendering
      // where the tooltip bumps up against the edge of the scrollable container. we could try to
      // kill the tooltip when it hits these boundaries rather than when scrolling starts.
      const scrollListener = () => {
        setPinned(false);
      };
      gridRoot?.addEventListener('scroll', scrollListener, { once: true });

      return () => {
        window.removeEventListener('click', windowListener);
        gridRoot?.removeEventListener('scroll', scrollListener);
      };
    }

    return;
  }, [pinned, gridRef]);

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

  const body = <>{renderer(rendererProps)}</>;

  // TODO: perist the hover if you mouse out of the trigger and into the popover
  const onMouseLeave = () => setHovered(false);
  const onMouseEnter = () => setHovered(true);

  return (
    <>
      {popoverRef.current && (
        <Popover
          content={body}
          show={show}
          placement={placement}
          wrapperClassName={classes.tooltipWrapper}
          className={className}
          style={{ ...style, minWidth: width, ...(!dynamicHeight && { height }) }}
          referenceElement={popoverRef.current}
          onMouseLeave={onMouseLeave}
          onMouseEnter={onMouseEnter}
          onClick={(ev) => ev.stopPropagation()} // prevent click from bubbling to the global click listener for un-pinning
          data-testid={selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper}
        />
      )}

      {/* TODO: figure out an accessible way to trigger the tooltip. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={classes.tooltipCaret}
        ref={tooltipCaretRef}
        data-testid={selectors.components.Panels.Visualization.TableNG.Tooltip.Caret}
        aria-pressed={pinned}
        onClick={() => setPinned((prev) => !prev)}
        onMouseLeave={onMouseLeave}
        onMouseEnter={onMouseEnter}
        onBlur={onMouseLeave}
        onFocus={onMouseEnter}
      />

      {children}
    </>
  );
}
