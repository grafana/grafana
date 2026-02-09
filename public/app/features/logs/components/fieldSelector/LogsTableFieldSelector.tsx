import { useCallback, useMemo } from 'react';

import { DataFrame, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { IconButton } from '@grafana/ui';
import { FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';
import { SETTING_KEY_ROOT } from 'app/features/explore/Logs/utils/logs';

import { FIELD_SELECTOR_MIN_WIDTH, FieldSelector, FieldWithStats, getDefaultFieldSelectorWidth } from './FieldSelector';
import { getFieldSelectorWidth } from './fieldSelectorUtils';
import { getFieldsWithStats } from './getFieldsWithStats';
import { getSuggestedFieldsFromTable } from './getSuggestedFieldsFromTable';
import { logsFieldSelectorWrapperStyles } from './styles';

/**
 * FieldSelector wrapper for the LogsTable visualization.
 */
interface LogsTableFieldSelectorProps {
  columnsWithMeta: FieldNameMetaStore;
  clear(): void;
  dataFrames: DataFrame[];
  reorder(columns: string[]): void;
  setWidth(width: number): void;
  width: number;
  toggle(key: string): void;
  getSuggestedFields?: (dataFrame: DataFrame, columns: string[], defaultColumns: string[]) => FieldWithStats[];
}

export const LogsTableFieldSelector = ({
  columnsWithMeta,
  clear: clearProp,
  dataFrames,
  reorder,
  setWidth,
  width,
  toggle,
  getSuggestedFields = getSuggestedFieldsFromTable,
}: LogsTableFieldSelectorProps) => {
  const setSidebarWidthWrapper = useCallback(
    (width: number) => {
      setWidth(width);
      store.set(`${SETTING_KEY_ROOT}.fieldSelector.width`, width);
    },
    [setWidth]
  );

  const collapse = useCallback(() => {
    setSidebarWidthWrapper(FIELD_SELECTOR_MIN_WIDTH);
    reportInteraction('logs_field_selector_collapse_clicked', {
      mode: 'table',
    });
  }, [setSidebarWidthWrapper]);

  const expand = useCallback(() => {
    const width = getFieldSelectorWidth(SETTING_KEY_ROOT);
    setSidebarWidthWrapper(width < 2 * FIELD_SELECTOR_MIN_WIDTH ? getDefaultFieldSelectorWidth() : width);
    reportInteraction('logs_field_selector_expand_clicked', {
      mode: 'table',
    });
  }, [setSidebarWidthWrapper]);

  const displayedColumns = useMemo(
    () =>
      Object.keys(columnsWithMeta)
        .filter((column) => columnsWithMeta[column].active)
        .sort((a, b) =>
          columnsWithMeta[a].index !== undefined && columnsWithMeta[b].index !== undefined
            ? columnsWithMeta[a].index - columnsWithMeta[b].index
            : 0
        ),
    [columnsWithMeta]
  );

  const clear = useCallback(() => {
    clearProp();
    reportInteraction('logs_field_selector_clear_fields_clicked', {
      fields: displayedColumns.length,
      mode: 'table',
    });
  }, [clearProp, displayedColumns.length]);

  const defaultColumns = useMemo(
    () =>
      Object.keys(columnsWithMeta)
        .sort((a, b) =>
          columnsWithMeta[a].index !== undefined && columnsWithMeta[b].index !== undefined
            ? columnsWithMeta[a].index - columnsWithMeta[b].index
            : 0
        )
        .filter(
          (column) => columnsWithMeta[column].type === 'TIME_FIELD' || columnsWithMeta[column].type === 'BODY_FIELD'
        ),
    [columnsWithMeta]
  );

  const suggestedFields = useMemo(() => {
    return getSuggestedFields(dataFrames[0], displayedColumns, defaultColumns);
  }, [dataFrames, defaultColumns, displayedColumns, getSuggestedFields]);
  const fields = useMemo(() => getFieldsWithStats(dataFrames), [dataFrames]);

  return width > FIELD_SELECTOR_MIN_WIDTH * 2 ? (
    <FieldSelector
      activeFields={displayedColumns}
      clear={clear}
      collapse={collapse}
      fields={fields}
      reorder={reorder}
      suggestedFields={suggestedFields}
      toggle={toggle}
    />
  ) : (
    <div className={logsFieldSelectorWrapperStyles.collapsedButtonContainer}>
      <IconButton
        className={logsFieldSelectorWrapperStyles.collapsedButton}
        onClick={expand}
        name="arrow-from-right"
        tooltip={t('logs.field-selector.expand', 'Expand sidebar')}
        size="sm"
      />
    </div>
  );
};
