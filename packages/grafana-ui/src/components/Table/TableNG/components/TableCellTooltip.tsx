import { CSSProperties, ReactElement, useMemo, useState, useRef, useEffect } from 'react';

import { ActionModel, DataFrame, Field, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TableCellTooltipPlacement } from '@grafana/schema';

import { Popover } from '../../../Tooltip/Popover';
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
  const tooltipCaretRef = useRef<HTMLDivElement>(null);
  const tooltipContentRef = useRef<HTMLDivElement>(null);

  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  const show = hovered || pinned;

  useEffect(() => {
    if (pinned) {
      const clickListener = (event: MouseEvent) => {
        const clickTarget = event.target;
        if (!(clickTarget instanceof HTMLElement)) {
          return;
        }

        if (!tooltipContentRef.current?.contains(clickTarget) && !tooltipCaretRef.current?.contains(clickTarget)) {
          setPinned(false);
          window.removeEventListener('click', clickListener);
        }
      };

      const scrollListener = () => {
        setPinned(false);
        window.removeEventListener('scroll', scrollListener);
      };

      window.addEventListener('click', clickListener);
      root?.addEventListener('scroll', scrollListener);

      return () => {
        window.removeEventListener('click', clickListener);
        root?.removeEventListener('scroll', scrollListener);
      };
    }

    return;
  }, [pinned, root]);

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

  const onMouseLeave = () => setHovered(false);
  const onMouseEnter = () => setHovered(true);

  return (
    <>
      {popoverRef.current && (
        <Popover
          content={body}
          show={show}
          placement={placement}
          wrapperClassName={tooltipWrapperClass}
          className={className}
          root={root}
          style={{ ...style, width, height }}
          referenceElement={popoverRef.current}
          onMouseLeave={onMouseLeave}
          onMouseEnter={onMouseEnter}
        />
      )}

      {/* a11y is handled by connecting this tooltip with the selection system. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={tooltipCaretClassName}
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
