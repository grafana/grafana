import { memo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { Dropdown } from '../../../Dropdown/Dropdown';
import { IconButton } from '../../../IconButton/IconButton';
import { Menu } from '../../../Menu/Menu';
import { useOpenLayersContext } from '../../geo';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, type TableCellActionsProps } from '../types';
import { buildInspectValue } from '../utils';

export const TableCellActions = memo(
  ({
    field,
    value,
    setInspectCell,
    onCellFilterAdded,
    className,
    cellInspect,
    showFilters,
    tableRefreshEnabled,
  }: TableCellActionsProps) => {
    const { formatGeometry } = useOpenLayersContext();

    if (tableRefreshEnabled) {
      if (!cellInspect && !showFilters) {
        return null;
      }
      const menuLabel = t('grafana-ui.table.cell-actions', 'Cell actions');
      return (
        // Portal events also bubble through this wrapper; do not activate the cell's data links.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div className={className} onClick={(ev) => ev.stopPropagation()} onMouseDown={(ev) => ev.stopPropagation()}>
          <Dropdown
            placement="bottom-end"
            overlay={
              <Menu ariaLabel={menuLabel}>
                {cellInspect && (
                  <Menu.Item
                    label={t('grafana-ui.table.cell-inspect-tooltip', 'Inspect value')}
                    icon="eye"
                    testId={selectors.components.Panels.Visualization.TableNG.cellActions.inspectButton}
                    onClick={() => {
                      const [inspectValue, mode] = buildInspectValue(value, field, formatGeometry);
                      setInspectCell({ value: inspectValue, mode });
                    }}
                  />
                )}
                {cellInspect && showFilters && <Menu.Divider />}
                {showFilters && (
                  <>
                    <Menu.Item
                      label={t('grafana-ui.table.cell-filter-on', 'Filter for value')}
                      icon="filter-plus"
                      testId={selectors.components.Panels.Visualization.TableNG.cellActions.filterForButton}
                      onClick={() =>
                        onCellFilterAdded?.({
                          key: field.name,
                          operator: FILTER_FOR_OPERATOR,
                          value: String(value ?? ''),
                        })
                      }
                    />
                    <Menu.Item
                      label={t('grafana-ui.table.cell-filter-out', 'Filter out value')}
                      icon="filter-minus"
                      testId={selectors.components.Panels.Visualization.TableNG.cellActions.filterOutButton}
                      onClick={() =>
                        onCellFilterAdded?.({
                          key: field.name,
                          operator: FILTER_OUT_OPERATOR,
                          value: String(value ?? ''),
                        })
                      }
                    />
                  </>
                )}
              </Menu>
            }
          >
            <IconButton
              name="ellipsis-v"
              size="sm"
              aria-label={menuLabel}
              title={menuLabel}
              data-testid={selectors.components.Panels.Visualization.TableNG.cellActions.triggerButton}
            />
          </Dropdown>
        </div>
      );
    }

    return (
      // stopping propagation to prevent clicks within the actions menu from triggering the cell click events
      // for things like the data links tooltip.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div className={className} onClick={(ev) => ev.stopPropagation()}>
        {cellInspect && (
          <IconButton
            name="eye"
            data-testid={selectors.components.Panels.Visualization.TableNG.cellActions.inspectButton}
            aria-label={t('grafana-ui.table.cell-inspect-tooltip', 'Inspect value')}
            onClick={() => {
              const [inspectValue, mode] = buildInspectValue(value, field, formatGeometry);
              setInspectCell({ value: inspectValue, mode });
            }}
          />
        )}
        {showFilters && (
          <>
            <IconButton
              name={'filter-plus'}
              data-testid={selectors.components.Panels.Visualization.TableNG.cellActions.filterForButton}
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
              data-testid={selectors.components.Panels.Visualization.TableNG.cellActions.filterOutButton}
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
    );
  }
);
TableCellActions.displayName = 'TableCellActions';
