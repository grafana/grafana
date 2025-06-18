import { css, cx } from '@emotion/css';
import { Property } from 'csstype';
import { WKT } from 'ol/format';
import { Geometry } from 'ol/geom';
import { ReactNode } from 'react';

import { FieldType, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TableCellDisplayMode } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { IconButton } from '../../../IconButton/IconButton';
import { TableCellInspectorMode } from '../../TableCellInspector';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, TableCellNGProps } from '../types';
import { isCustomCellOptions } from '../utils';

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
    value,
    cellOptions,
    displayName,
    setIsInspecting,
    setContextMenuProps,
    onCellFilterAdded,
    justifyContent,
    children,
  } = props;

  const cellInspect = field.config?.custom?.inspect ?? false;
  const showFilters = field.config.filterable && onCellFilterAdded;
  const styles = useStyles2(getStyles, justifyContent);
  const hasActions = cellInspect || showFilters;

  return (
    <>
      {children}
      {hasActions && (
        <div className={cx(styles.cellActions, 'table-cell-actions')}>
          {cellInspect && (
            <IconButton
              name="eye"
              aria-label={t('grafana-ui.table.cell-inspect-tooltip', 'Inspect value')}
              onClick={() => {
                let inspectValue = value;
                let mode = TableCellInspectorMode.text;

                if (field.type === FieldType.geo && value instanceof Geometry) {
                  inspectValue = new WKT().writeGeometry(value, {
                    featureProjection: 'EPSG:3857',
                    dataProjection: 'EPSG:4326',
                  });
                  mode = TableCellInspectorMode.code;
                } else if ('cellType' in cellOptions && cellOptions.cellType === TableCellDisplayMode.JSONView) {
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
                aria-label={t('grafana-ui.table.cell-filter-on', 'Filter for value')}
                onClick={() => {
                  onCellFilterAdded?.({
                    key: displayName,
                    operator: FILTER_FOR_OPERATOR,
                    value: String(value ?? ''),
                  });
                }}
              />
              <IconButton
                name={'search-minus'}
                aria-label={t('grafana-ui.table.cell-filter-out', 'Filter out value')}
                onClick={() => {
                  onCellFilterAdded?.({
                    key: displayName,
                    operator: FILTER_OUT_OPERATOR,
                    value: String(value ?? ''),
                  });
                }}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2, justifyColumnContent: Property.JustifyContent) => ({
  cellActions: css({
    display: 'none',
    position: 'absolute',
    top: 0,
    margin: 'auto',
    height: '100%',
    color: theme.colors.text.primary,
    background: theme.isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
    padding: theme.spacing.x0_5,
    paddingInlineStart: theme.spacing.x1,
    [justifyColumnContent === 'flex-end' ? 'left' : 'right']: 0,
  }),
});

export type TableNGCellRenderer = (props: Omit<TableCellNGProps, 'children'>) => ReactNode;

const GAUGE_RENDERER: TableNGCellRenderer = (props) => <BarGaugeCell {...props} />;
const AUTO_RENDERER: TableNGCellRenderer = (props) => <AutoCell {...props} />;

/** @internal */
export const SPARKLINE_RENDERER: TableNGCellRenderer = (props) => <SparklineCell {...props} />;
/** @internal */
export const JSON_RENDERER: TableNGCellRenderer = (props) => <JSONCell {...props} />;
/** @internal */
export const GEO_RENDERER: TableNGCellRenderer = (props) => <GeoCell {...props} />;

export const CELL_RENDERERS: Record<TableCellDisplayMode, TableNGCellRenderer> = {
  [TableCellDisplayMode.Sparkline]: SPARKLINE_RENDERER,
  [TableCellDisplayMode.Gauge]: GAUGE_RENDERER,
  [TableCellDisplayMode.BasicGauge]: GAUGE_RENDERER,
  [TableCellDisplayMode.GradientGauge]: GAUGE_RENDERER,
  [TableCellDisplayMode.LcdGauge]: GAUGE_RENDERER,
  [TableCellDisplayMode.JSONView]: JSON_RENDERER,
  [TableCellDisplayMode.Image]: (props) => <ImageCell {...props} />,
  [TableCellDisplayMode.DataLinks]: (props) => <DataLinksCell {...props} />,
  [TableCellDisplayMode.Actions]: (props) => <ActionsCell {...props} />,
  [TableCellDisplayMode.Custom]: (props) => {
    if (!isCustomCellOptions(props.cellOptions) || !props.cellOptions.cellComponent) {
      return null; // nonsensical case, but better to typeguard it.
    }
    const CustomCellComponent = props.cellOptions.cellComponent;
    return <CustomCellComponent {...props} rowIndex={props.rowIdx} />;
  },
  [TableCellDisplayMode.ColorText]: AUTO_RENDERER,
  [TableCellDisplayMode.ColorBackground]: AUTO_RENDERER,
  [TableCellDisplayMode.ColorBackgroundSolid]: AUTO_RENDERER,
  [TableCellDisplayMode.Auto]: AUTO_RENDERER,
};

/**
 * Uncovered lines:
 * - TableCellDisplayMode.Sparkline, FieldType.frame sparkline
 * - GeoCell
 * - JSONCell
 * - onCellFilterAdded, onFilterFor, onFilterOut
 * - inspect onClick
 */
