import WKT from 'ol/format/WKT';
import Geometry from 'ol/geom/Geometry';

import { FieldType } from '@grafana/data';
import { t } from '@grafana/i18n';

import { IconButton } from '../../../IconButton/IconButton';
import { TableCellInspectorMode } from '../../TableCellInspector';
import { TableCellDisplayMode } from '../../types';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, TableCellActionsProps } from '../types';

export function TableCellActions(props: TableCellActionsProps) {
  const {
    field,
    value,
    cellOptions,
    displayName,
    setIsInspecting,
    setContextMenuProps,
    onCellFilterAdded,
    className,
    cellInspect,
    showFilters,
  } = props;

  return (
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

            if (field.type === FieldType.geo && value instanceof Geometry) {
              inspectValue = new WKT().writeGeometry(value, {
                featureProjection: 'EPSG:3857',
                dataProjection: 'EPSG:4326',
              });
              mode = TableCellInspectorMode.code;
            }
            if (cellOptions.type === TableCellDisplayMode.JSONView) {
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
            name={'filter-plus'}
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
            name={'filter-minus'}
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
  );
}
