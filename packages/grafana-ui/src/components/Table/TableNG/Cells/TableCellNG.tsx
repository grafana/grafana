import { css } from '@emotion/css';
import { ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { TableAutoCellOptions, TableCellDisplayMode } from '@grafana/schema';

import { useStyles2 } from '../../../../themes';
import { IconButton } from '../../../IconButton/IconButton';
import { TableCellInspectorMode } from '../../TableCellInspector';
import { CellColors, TableCellNGProps } from '../types';
import { getCellColors, getTextAlign } from '../utils';

import { ActionsCell } from './ActionsCell';
import AutoCell from './AutoCell';
import { BarGaugeCell } from './BarGaugeCell';
import { DataLinksCell } from './DataLinksCell';
import { ImageCell } from './ImageCell';
import { JSONCell } from './JSONCell';
import { SparklineCell } from './SparklineCell';

export function TableCellNG(props: TableCellNGProps) {
  const {
    field,
    frame,
    value,
    theme,
    timeRange,
    height,
    rowIdx,
    justifyContent,
    shouldTextOverflow,
    setIsInspecting,
    setContextMenuProps,
    cellInspect,
    getActions,
    rowBg,
  } = props;

  const { config: fieldConfig } = field;
  const defaultCellOptions: TableAutoCellOptions = { type: TableCellDisplayMode.Auto };
  const cellOptions = fieldConfig.custom?.cellOptions ?? defaultCellOptions;
  const { type: cellType } = cellOptions;

  const isRightAligned = getTextAlign(field) === 'flex-end';
  const displayValue = field.display!(value);
  let colors: CellColors = { bgColor: '', textColor: '', bgHoverColor: '' };
  if (rowBg) {
    colors = rowBg(rowIdx);
  } else {
    colors = useMemo(() => getCellColors(theme, cellOptions, displayValue), [theme, cellOptions, displayValue]);
  }
  const styles = useStyles2(getStyles, isRightAligned, colors);

  // TODO
  // TableNG provides either an overridden cell width or 'auto' as the cell width value.
  // While the overridden value gives the exact cell width, 'auto' does not.
  // Therefore, we need to determine the actual cell width from the DOM.
  const divWidthRef = useRef<HTMLDivElement>(null);
  const [divWidth, setDivWidth] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const actions = getActions ? getActions(frame, field, rowIdx) : [];

  useLayoutEffect(() => {
    if (divWidthRef.current && divWidthRef.current.clientWidth !== 0) {
      setDivWidth(divWidthRef.current.clientWidth);
    }
  }, [divWidthRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get the correct cell type
  let cell: ReactNode = null;
  switch (cellType) {
    case TableCellDisplayMode.Sparkline:
      cell = (
        <SparklineCell
          value={value}
          field={field}
          theme={theme}
          timeRange={timeRange}
          width={divWidth}
          rowIdx={rowIdx}
          justifyContent={justifyContent}
        />
      );
      break;
    case TableCellDisplayMode.Gauge:
    case TableCellDisplayMode.BasicGauge:
    case TableCellDisplayMode.GradientGauge:
    case TableCellDisplayMode.LcdGauge:
      cell = (
        <BarGaugeCell
          value={value}
          field={field}
          theme={theme}
          timeRange={timeRange}
          height={height}
          width={divWidth}
          rowIdx={rowIdx}
        />
      );
      break;
    case TableCellDisplayMode.Image:
      cell = (
        <ImageCell
          cellOptions={cellOptions}
          field={field}
          height={height}
          justifyContent={justifyContent}
          value={value}
          rowIdx={rowIdx}
        />
      );
      break;
    case TableCellDisplayMode.JSONView:
      cell = <JSONCell value={value} justifyContent={justifyContent} field={field} rowIdx={rowIdx} />;
      break;
    case TableCellDisplayMode.DataLinks:
      cell = <DataLinksCell field={field} rowIdx={rowIdx} />;
      break;
    case TableCellDisplayMode.Actions:
      cell = <ActionsCell actions={actions} />;
      break;
    case TableCellDisplayMode.Auto:
    default:
      cell = (
        <AutoCell
          value={value}
          field={field}
          justifyContent={justifyContent}
          rowIdx={rowIdx}
          cellOptions={cellOptions}
        />
      );
  }

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (shouldTextOverflow()) {
      // TODO: The table cell styles in TableNG do not update dynamically even if we change the state
      const div = divWidthRef.current;
      const tableCellDiv = div?.parentElement;
      tableCellDiv?.style.setProperty('position', 'absolute');
      tableCellDiv?.style.setProperty('top', '0');
      tableCellDiv?.style.setProperty('z-index', String(theme.zIndex.tooltip));
      tableCellDiv?.style.setProperty('white-space', 'normal');
      tableCellDiv?.style.setProperty('min-height', `${height}px`);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (shouldTextOverflow()) {
      // TODO: The table cell styles in TableNG do not update dynamically even if we change the state
      const div = divWidthRef.current;
      const tableCellDiv = div?.parentElement;
      tableCellDiv?.style.setProperty('position', 'relative');
      tableCellDiv?.style.removeProperty('top');
      tableCellDiv?.style.removeProperty('z-index');
      tableCellDiv?.style.setProperty('white-space', 'nowrap');
    }
  };

  return (
    <div ref={divWidthRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className={styles.cell}>
      {cell}
      {cellInspect && isHovered && (
        <div className={styles.cellActions}>
          <IconButton
            name="eye"
            tooltip="Inspect value"
            onClick={() => {
              setContextMenuProps({
                value: String(value ?? ''),
                mode:
                  cellType === TableCellDisplayMode.JSONView
                    ? TableCellInspectorMode.code
                    : TableCellInspectorMode.text,
              });
              setIsInspecting(true);
            }}
          />
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, isRightAligned: boolean, color: CellColors) => ({
  cell: css({
    height: '100%',
    alignContent: 'center',
    paddingInline: '8px',
    // TODO: follow-up on this: change styles on hover on table row level
    background: color.bgColor || 'none',
    color: color.textColor,
    '&:hover': { background: color.bgHoverColor },
  }),
  cellActions: css({
    display: 'flex',
    position: 'absolute',
    top: '1px',
    left: isRightAligned ? 0 : undefined,
    right: isRightAligned ? undefined : 0,
    margin: 'auto',
    height: '100%',
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    padding: '4px 0px 4px 4px',
  }),
});
