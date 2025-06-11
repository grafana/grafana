import { css, cx } from '@emotion/css';
import { WKT } from 'ol/format';
import { Geometry } from 'ol/geom';
import { ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { FieldType, getDefaultTimeRange, GrafanaTheme2, isDataFrame, isTimeSeriesFrame } from '@grafana/data';
import { TableAutoCellOptions, TableCellDisplayMode } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { t } from '../../../../utils/i18n';
import { IconButton } from '../../../IconButton/IconButton';
import { TableCellInspectorMode } from '../../TableCellInspector';
import { TABLE } from '../constants';
import {
  CellColors,
  CustomCellRendererProps,
  FILTER_FOR_OPERATOR,
  FILTER_OUT_OPERATOR,
  TableCellNGProps,
} from '../types';
import { getCellColors, getDisplayName, getTextAlign } from '../utils';

import { ActionsCell } from './ActionsCell';
import AutoCell from './AutoCell';
import { BarGaugeCell } from './BarGaugeCell';
import { DataLinksCell } from './DataLinksCell';
import { GeoCell } from './GeoCell';
import { ImageCell } from './ImageCell';
import { JSONCell } from './JSONCell';
import { SparklineCell } from './SparklineCell';

export function TableCellNG(props: TableCellNGProps) {
  const {
    field,
    frame,
    value,
    theme,
    timeRange = getDefaultTimeRange(),
    height,
    rowIdx,
    justifyContent,
    setIsInspecting,
    setContextMenuProps,
    getActions,
    rowBg,
    onCellFilterAdded,
    replaceVariables,
  } = props;

  const cellInspect = field.config?.custom?.inspect ?? false;
  const displayName = getDisplayName(field);

  const { config: fieldConfig } = field;
  const defaultCellOptions: TableAutoCellOptions = { type: TableCellDisplayMode.Auto };
  const cellOptions = fieldConfig.custom?.cellOptions ?? defaultCellOptions;
  const { type: cellType } = cellOptions;

  const showFilters = field.config.filterable && onCellFilterAdded;

  const isRightAligned = getTextAlign(field) === 'flex-end';
  const displayValue = field.display!(value);
  const colors: CellColors = useMemo(() => {
    if (rowBg) {
      return rowBg(rowIdx);
    }
    return getCellColors(theme, cellOptions, displayValue);
  }, [theme, cellOptions, displayValue, rowBg, rowIdx]);
  const styles = useStyles2(getStyles, height, isRightAligned, colors);

  // TODO
  // TableNG provides either an overridden cell width or 'auto' as the cell width value.
  // While the overridden value gives the exact cell width, 'auto' does not.
  // Therefore, we need to determine the actual cell width from the DOM.
  const divWidthRef = useRef<HTMLDivElement>(null);
  const [divWidth, setDivWidth] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const actions = useMemo(
    () => (getActions ? getActions(frame, field, rowIdx, replaceVariables) : []),
    [getActions, frame, field, rowIdx, replaceVariables]
  );

  useLayoutEffect(() => {
    if (divWidthRef.current && divWidthRef.current.clientWidth !== 0) {
      setDivWidth(divWidthRef.current.clientWidth);
    }
  }, [divWidthRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Common props for all cells
  const commonProps = useMemo(
    () => ({
      value,
      field,
      rowIdx,
      justifyContent,
    }),
    [value, field, rowIdx, justifyContent]
  );

  // Get the correct cell type
  const renderedCell = useMemo(() => {
    let cell: ReactNode = null;
    switch (cellType) {
      case TableCellDisplayMode.Sparkline:
        cell = <SparklineCell {...commonProps} theme={theme} timeRange={timeRange} width={divWidth} />;
        break;
      case TableCellDisplayMode.Gauge:
      case TableCellDisplayMode.BasicGauge:
      case TableCellDisplayMode.GradientGauge:
      case TableCellDisplayMode.LcdGauge:
        cell = (
          <BarGaugeCell
            {...commonProps}
            theme={theme}
            timeRange={timeRange}
            height={height}
            width={divWidth}
            actions={actions}
          />
        );
        break;
      case TableCellDisplayMode.Image:
        cell = <ImageCell {...commonProps} cellOptions={cellOptions} height={height} actions={actions} />;
        break;
      case TableCellDisplayMode.JSONView:
        cell = <JSONCell {...commonProps} actions={actions} />;
        break;
      case TableCellDisplayMode.DataLinks:
        cell = <DataLinksCell field={field} rowIdx={rowIdx} />;
        break;
      case TableCellDisplayMode.Actions:
        cell = <ActionsCell actions={actions} />;
        break;
      case TableCellDisplayMode.Custom:
        const CustomCellComponent: React.ComponentType<CustomCellRendererProps> = cellOptions.cellComponent;
        cell = <CustomCellComponent field={field} value={value} rowIndex={rowIdx} frame={frame} />;
        break;
      case TableCellDisplayMode.Auto:
      default:
        // Handle auto cell type detection
        if (field.type === FieldType.geo) {
          cell = <GeoCell {...commonProps} height={height} />;
        } else if (field.type === FieldType.frame) {
          const firstValue = field.values[0];
          if (isDataFrame(firstValue) && isTimeSeriesFrame(firstValue)) {
            cell = <SparklineCell {...commonProps} theme={theme} timeRange={timeRange} width={divWidth} />;
          } else {
            cell = <JSONCell {...commonProps} actions={actions} />;
          }
        } else if (field.type === FieldType.other) {
          cell = <JSONCell {...commonProps} actions={actions} />;
        } else {
          cell = <AutoCell {...commonProps} cellOptions={cellOptions} actions={actions} />;
        }
        break;
    }
    return cell;
  }, [cellType, commonProps, theme, timeRange, divWidth, height, cellOptions, field, rowIdx, actions, value, frame]);

  const hasActions = cellInspect || showFilters;

  const onFilterFor = useCallback(() => {
    if (onCellFilterAdded) {
      onCellFilterAdded({
        key: displayName,
        operator: FILTER_FOR_OPERATOR,
        value: String(value ?? ''),
      });
    }
  }, [displayName, onCellFilterAdded, value]);

  const onFilterOut = useCallback(() => {
    if (onCellFilterAdded) {
      onCellFilterAdded({
        key: displayName,
        operator: FILTER_OUT_OPERATOR,
        value: String(value ?? ''),
      });
    }
  }, [displayName, onCellFilterAdded, value]);

  return (
    <div
      ref={divWidthRef}
      className={styles.cell}
      onFocus={hasActions ? () => setIsHovered(true) : undefined}
      onMouseEnter={hasActions ? () => setIsHovered(true) : undefined}
      onBlur={hasActions ? () => setIsHovered(false) : undefined}
      onMouseLeave={hasActions ? () => setIsHovered(false) : undefined}
    >
      {renderedCell}
      {/* TODO: I really wanted to avoid the `isHovered` state, and just mount all of these
        icons, unhiding them using CSS, but rendering the IconButton is very expensive and
        makes the scroll performance terrible. I think it's because of the Tooltip.
        */}
      {isHovered && hasActions && (
        <div className={cx(styles.cellActions, 'table-cell-actions')}>
          {cellInspect && (
            <IconButton
              name="eye"
              tooltip={t('grafana-ui.table.cell-inspect-tooltip', 'Inspect value')}
              onClick={() => {
                let inspectValue = value;
                let mode = TableCellInspectorMode.text;

                if (field.type === FieldType.geo && value instanceof Geometry) {
                  inspectValue = new WKT().writeGeometry(value, {
                    featureProjection: 'EPSG:3857',
                    dataProjection: 'EPSG:4326',
                  });
                  mode = TableCellInspectorMode.code;
                } else if (cellType === TableCellDisplayMode.JSONView) {
                  mode = TableCellInspectorMode.code;
                }

                setContextMenuProps({
                  value: String(inspectValue ?? ''),
                  mode,
                });
                setIsInspecting(true);
              }}
            />
          )}
          {showFilters && (
            <>
              <IconButton
                name={'search-plus'}
                onClick={onFilterFor}
                tooltip={t('grafana-ui.table.cell-filter-on', 'Filter for value')}
              />
              <IconButton
                name={'search-minus'}
                onClick={onFilterOut}
                tooltip={t('grafana-ui.table.cell-filter-out', 'Filter out value')}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, defaultRowHeight: number, isRightAligned: boolean, color: CellColors) => ({
  cell: css({
    height: '100%',
    // this minHeight interacts with the `fit-content` property on
    // the container for table cell overflow rendering.
    minHeight: defaultRowHeight - 1,
    alignContent: 'center',
    paddingInline: TABLE.CELL_PADDING,
    // TODO: follow-up on this: change styles on hover on table row level
    background: color.bgColor || 'none',
    color: color.textColor,
    '&:hover': {
      background: color.bgHoverColor,
    },
  }),
  cellActions: css({
    display: 'flex',
    position: 'absolute',
    top: 0,
    left: isRightAligned ? 0 : undefined,
    right: isRightAligned ? undefined : 0,
    margin: 'auto',
    height: '100%',
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    padding: '4px 0 4px 4px',
  }),
});
