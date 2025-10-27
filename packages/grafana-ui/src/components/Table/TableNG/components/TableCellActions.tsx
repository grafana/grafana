import WKT from 'ol/format/WKT';
import Geometry from 'ol/geom/Geometry';
import { memo } from 'react';

import { FieldType } from '@grafana/data';
import { t } from '@grafana/i18n';

import { IconButton } from '../../../IconButton/IconButton';
import { TableCellInspectorMode } from '../../TableCellInspector';
import { TableCellDisplayMode } from '../../types';
import { getAutoRendererDisplayMode } from '../Cells/renderers';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, TableCellActionsProps } from '../types';
import { buildSparklineInspect, prepareSparklineValue } from '../utils';

export const TableCellActions = memo(
  ({
    field,
    value,
    cellOptions,
    setInspectCell,
    onCellFilterAdded,
    className,
    cellInspect,
    showFilters,
  }: TableCellActionsProps) => (
    // stopping propagation to prevent clicks within the actions menu from triggering the cell click events
    // for things like the data links tooltip.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className={className} onClick={(ev) => ev.stopPropagation()}>
      {cellInspect && (
        <IconButton
          name="eye"
          aria-label={t('grafana-ui.table.cell-inspect-tooltip', 'Inspect value')}
          onClick={() => {
            let inspectValue = value;
            let mode = TableCellInspectorMode.text;
            let preformatted = false;

            if (field.type === FieldType.geo && value instanceof Geometry) {
              inspectValue = new WKT().writeGeometry(value, {
                featureProjection: 'EPSG:3857',
                dataProjection: 'EPSG:4326',
              });
              mode = TableCellInspectorMode.code;
            }
            if (
              cellOptions.type === TableCellDisplayMode.Sparkline ||
              getAutoRendererDisplayMode(field) === TableCellDisplayMode.Sparkline
            ) {
              // rather than JSON.stringify this, manually format it to make the coordinate tuples more legible to the user.
              inspectValue += buildSparklineInspect(prepareSparklineValue(value, field));
              mode = TableCellInspectorMode.code;
              preformatted = true;
            }
            if (cellOptions.type === TableCellDisplayMode.JSONView) {
              mode = TableCellInspectorMode.code;
            }

            setInspectCell({
              value: String(inspectValue ?? ''),
              mode,
              preformatted,
            });
          }}
        />
      )}
      {showFilters && (
        <>
          <IconButton
            name={'filter-plus'}
            aria-label={t('grafana-ui.table.cell-filter-on', 'Filter for value')}
            onClick={() => {
              onCellFilterAdded?.({
                key: field.name,
                operator: FILTER_FOR_OPERATOR,
                value: String(value ?? ''),
              });
            }}
          />
          <IconButton
            name={'filter-minus'}
            aria-label={t('grafana-ui.table.cell-filter-out', 'Filter out value')}
            onClick={() => {
              onCellFilterAdded?.({
                key: field.name,
                operator: FILTER_OUT_OPERATOR,
                value: String(value ?? ''),
              });
            }}
          />
        </>
      )}
    </div>
  )
);
TableCellActions.displayName = 'TableCellActions';
