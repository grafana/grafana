import { css, cx } from '@emotion/css';
import { WKT } from 'ol/format';
import { Geometry } from 'ol/geom';
import { ReactNode, useCallback, useMemo, useRef } from 'react';

import { FieldType, getDefaultTimeRange, GrafanaTheme2, isDataFrame, isTimeSeriesFrame } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TableAutoCellOptions, TableCellDisplayMode } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
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
    width,
  } = props;

  const cellInspect = field.config?.custom?.inspect ?? false;
  const displayName = getDisplayName(field);

  const { config: fieldConfig } = field;
  const defaultCellOptions: TableAutoCellOptions = { type: TableCellDisplayMode.Auto };
  const cellOptions = fieldConfig.custom?.cellOptions ?? defaultCellOptions;
  const { type: cellType } = cellOptions;

  const divWidthRef = useRef<HTMLDivElement>(null);

  const showFilters = field.config.filterable && onCellFilterAdded;

  const isRightAligned = useMemo(() => getTextAlign(field) === 'flex-end', [field]);
  const displayValue = useMemo(() => field.display!(value), [field.display, value]);
  const colors: CellColors = useMemo(
    () => (rowBg ? rowBg(rowIdx) : getCellColors(theme, cellOptions, displayValue)),
    [theme, cellOptions, displayValue, rowBg, rowIdx]
  );
  const styles = useStyles2(getStyles, height, isRightAligned, colors);

  const actions = useMemo(
    () => (getActions ? getActions(frame, field, rowIdx, replaceVariables) : []),
    [getActions, frame, field, rowIdx, replaceVariables]
  );

  // Common props for all cells
  const commonProps = {
    value,
    field,
    rowIdx,
    justifyContent,
  } as const;

  // Get the correct cell type
  const renderedCell = (): ReactNode => {
    switch (cellType) {
      case TableCellDisplayMode.Sparkline:
        return <SparklineCell {...commonProps} theme={theme} timeRange={timeRange} width={width} />;
      case TableCellDisplayMode.Gauge:
      case TableCellDisplayMode.BasicGauge:
      case TableCellDisplayMode.GradientGauge:
      case TableCellDisplayMode.LcdGauge: {
        return (
          <BarGaugeCell
            {...commonProps}
            theme={theme}
            timeRange={timeRange}
            height={height}
            width={width}
            actions={actions}
          />
        );
      }
      case TableCellDisplayMode.Image:
        return <ImageCell {...commonProps} cellOptions={cellOptions} height={height} actions={actions} />;
      case TableCellDisplayMode.JSONView:
        return <JSONCell {...commonProps} actions={actions} />;
      case TableCellDisplayMode.DataLinks:
        return <DataLinksCell field={field} rowIdx={rowIdx} />;
      case TableCellDisplayMode.Actions:
        return <ActionsCell actions={actions} />;
      case TableCellDisplayMode.Custom:
        const CustomCellComponent: React.ComponentType<CustomCellRendererProps> = cellOptions.cellComponent;
        return <CustomCellComponent field={field} value={value} rowIndex={rowIdx} frame={frame} />;
      case TableCellDisplayMode.Auto:
      default: {
        // Handle auto cell type detection
        if (field.type === FieldType.geo) {
          return <GeoCell {...commonProps} height={height} />;
        } else if (field.type === FieldType.frame) {
          const firstValue = field.values[0];
          if (isDataFrame(firstValue) && isTimeSeriesFrame(firstValue)) {
            return <SparklineCell {...commonProps} theme={theme} timeRange={timeRange} width={width} />;
          } else {
            return <JSONCell {...commonProps} actions={actions} />;
          }
        } else if (field.type === FieldType.other) {
          return <JSONCell {...commonProps} actions={actions} />;
        }
        return <AutoCell {...commonProps} cellOptions={cellOptions} actions={actions} />;
      }
    }
  };

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
    <div ref={divWidthRef} className={styles.cell}>
      {renderedCell()}
      {hasActions && (
        <div className={cx(styles.cellActions, 'table-cell-actions')}>
          {cellInspect && (
            <IconButton
              name="eye"
              aria-label={t('grafana-ui.table.cell-inspect-tooltip', 'Inspect value')}
              className={styles.cellInspectButton}
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
      '.table-cell-actions': {
        display: 'flex',
      },
    },
  }),
  cellActions: css({
    display: 'none',
    position: 'absolute',
    top: 0,
    left: isRightAligned ? 0 : undefined,
    right: isRightAligned ? undefined : 0,
    margin: 'auto',
    height: '100%',
    color: theme.colors.text.primary,
  }),
  cellInspectButton: css({
    display: 'flex',
    margin: 0,
    padding: theme.spacing.x0_5,
    [isRightAligned ? 'paddingLeft' : 'paddingRight']: theme.spacing.x1,
    height: '100%',
    '&:hover:before': {
      height: '100%',
      width: '100%',
    },
  }),
});

/**
 * Uncovered lines:
 * - TableCellDisplayMode.Sparkline, FieldType.frame sparkline
 * - GeoCell
 * - JSONCell
 * - onCellFilterAdded, onFilterFor, onFilterOut
 * - inspect onClick
 */
