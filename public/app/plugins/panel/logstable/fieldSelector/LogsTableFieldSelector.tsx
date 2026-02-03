import { css } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import { useCallback, useMemo } from 'react';

import { DataFrame, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { getDragStyles, IconButton, useStyles2 } from '@grafana/ui';
import { FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';
import {
  FIELD_SELECTOR_MIN_WIDTH,
  FIELD_SELECTOR_DEFAULT_WIDTH,
} from 'app/features/logs/components/fieldSelector/FieldSelector';
import { getFieldSelectorWidth } from 'app/features/logs/components/fieldSelector/fieldSelectorUtils';
import { reportInteractionOnce } from 'app/features/logs/components/panel/analytics';

import { FieldSelector } from './FieldSelector';
import { getFieldsWithStats } from './getFieldsWithStats';
import { getSuggestedFields } from './getSuggestedFields';

const SETTING_KEY_ROOT = 'grafana.panel.logs-table';

const logsFieldSelectorWrapperStyles = {
  collapsedButtonContainer: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 2,
  }),
  collapsedButton: css({
    margin: 0,
  }),
};

/**
 * @todo sync with version used in logs
 * FieldSelector wrapper for the LogsTable visualization.
 */
interface LogsTableFieldSelectorProps {
  columnsWithMeta: FieldNameMetaStore;
  dataFrames: DataFrame[];
  sidebarWidth: number;
  sidebarHeight: number;
  maxWidth: number;

  clear(): void;

  reorder(columns: string[]): void;

  setSidebarWidth(width: number): void;

  toggle(key: string): void;
}

// Copy pasta from /app/features/logs/components/fieldSelector/FieldSelector.tsx (removed LogListModel, added resizable)
// @todo centralize/deprecate
export const LogsTableFieldSelector = ({
  columnsWithMeta,
  clear: clearProp,
  dataFrames,
  reorder,
  setSidebarWidth,
  sidebarWidth,
  toggle,
  sidebarHeight,
  maxWidth,
}: LogsTableFieldSelectorProps) => {
  const dragStyles = useStyles2(getDragStyles);

  const setSidebarWidthWrapper = useCallback(
    (width: number) => {
      setSidebarWidth(width);
      // Getting value in getFieldSelectorWidth
      store.set(`${SETTING_KEY_ROOT}.fieldSelector.width`, width);
    },
    [setSidebarWidth]
  );

  const collapse = useCallback(() => {
    setSidebarWidthWrapper(FIELD_SELECTOR_MIN_WIDTH);
    reportInteraction(`${SETTING_KEY_ROOT}.field_selector_collapse_clicked`, {
      mode: 'table',
    });
  }, [setSidebarWidthWrapper]);

  const expand = useCallback(() => {
    const width = getFieldSelectorWidth(SETTING_KEY_ROOT);
    setSidebarWidthWrapper(width < 2 * FIELD_SELECTOR_MIN_WIDTH ? FIELD_SELECTOR_DEFAULT_WIDTH : width);
    reportInteraction(`${SETTING_KEY_ROOT}.field_selector_expand_clicked`, {
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
    reportInteraction(`${SETTING_KEY_ROOT}.field_selector_clear_fields_clicked`, {
      fields: displayedColumns.length,
      mode: 'table',
    });
  }, [clearProp, displayedColumns.length]);

  const handleResize: ResizeCallback = useCallback(
    (event, direction, ref) => {
      setSidebarWidthWrapper(ref.clientWidth);
      reportInteractionOnce(`${SETTING_KEY_ROOT}.field_selector_resized`, {
        mode: 'logs',
      });
    },
    [setSidebarWidthWrapper]
  );

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
    return getSuggestedFields(displayedColumns, defaultColumns);
  }, [defaultColumns, displayedColumns]);
  const fields = useMemo(() => getFieldsWithStats(dataFrames), [dataFrames]);

  if (sidebarHeight === 0) {
    return null;
  }

  return (
    <Resizable
      enable={{
        right: true,
      }}
      handleClasses={{ right: dragStyles.dragHandleVertical }}
      size={{ width: sidebarWidth, height: sidebarHeight }}
      defaultSize={{ width: sidebarWidth, height: sidebarHeight }}
      minWidth={FIELD_SELECTOR_MIN_WIDTH}
      maxWidth={maxWidth}
      onResize={handleResize}
    >
      {sidebarWidth > FIELD_SELECTOR_MIN_WIDTH * 2 ? (
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
      )}
    </Resizable>
  );
};
