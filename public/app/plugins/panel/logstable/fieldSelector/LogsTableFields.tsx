import { css } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DataFrame, GrafanaTheme2, store } from '@grafana/data';
import { getDragStyles, useStyles2 } from '@grafana/ui';
import { FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';
import { SETTING_KEY_ROOT } from 'app/features/explore/Logs/utils/logs';
import {
  FIELD_SELECTOR_DEFAULT_WIDTH,
  FIELD_SELECTOR_MIN_WIDTH,
} from 'app/features/logs/components/fieldSelector/FieldSelector';
import { LogsTableFieldSelector } from 'app/features/logs/components/fieldSelector/LogsTableFieldSelector';
import { reportInteractionOnce } from 'app/features/logs/components/panel/analytics';
import { LogsFrame } from 'app/features/logs/logsFrame';

import { buildColumnsWithMeta } from './buildColumnsWithMeta';

interface Props {
  sidebarWidth: number | undefined;
  tableWidth: number;
  height: number;
  dataFrame: DataFrame;
  displayedFields: string[];
  onDisplayedFieldsChange: (displayedFields: string[]) => void;
  onSidebarWidthChange: (width: number) => void;
  logsFrame: LogsFrame;
  timeFieldName: string;
  bodyFieldName: string;
}

export function LogsTableFields({
  tableWidth,
  sidebarWidth = FIELD_SELECTOR_DEFAULT_WIDTH,
  height,
  dataFrame,
  displayedFields,
  onDisplayedFieldsChange,
  timeFieldName,
  bodyFieldName,
  logsFrame,
  onSidebarWidthChange,
}: Props) {
  const styles = useStyles2(getStyles, sidebarWidth, height);
  const dragStyles = useStyles2(getDragStyles);
  const [containerElement, setContainerRefState] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement) => {
    setContainerRefState(node);
  }, []);

  const defaultDisplayedFields = useMemo(() => [timeFieldName, bodyFieldName], [timeFieldName, bodyFieldName]);
  const [columnsWithMeta, setColumnsWithMeta] = useState<FieldNameMetaStore | null>(null);

  const handleSetColumnsWithMeta = useCallback((columnsWithMeta: FieldNameMetaStore) => {
    setColumnsWithMeta(columnsWithMeta);
  }, []);

  const setSidebarWidthWrapper = useCallback(
    (width: number) => {
      onSidebarWidthChange(width);
      // Getting value in getFieldSelectorWidth
      store.set(`${SETTING_KEY_ROOT}.table.fieldSelector.width`, width);
    },
    [onSidebarWidthChange]
  );

  const handleResize: ResizeCallback = useCallback(
    (event, direction, ref) => {
      setSidebarWidthWrapper(ref.clientWidth);
      reportInteractionOnce(`${SETTING_KEY_ROOT}.table.field_selector_resized`, {
        mode: 'logs',
      });
    },
    [setSidebarWidthWrapper]
  );

  /**
   * Build columns meta
   */
  useEffect(() => {
    if (logsFrame === null) {
      return;
    }

    handleSetColumnsWithMeta(
      buildColumnsWithMeta(
        {
          extraFields: logsFrame.extraFields,
          bodyField: logsFrame.bodyField,
          severityField: logsFrame.severityField,
          timeField: logsFrame.timeField,
        },
        dataFrame,
        displayedFields ?? defaultDisplayedFields
      )
    );
  }, [displayedFields, handleSetColumnsWithMeta, logsFrame, defaultDisplayedFields, dataFrame]);

  if (columnsWithMeta === null || displayedFields === undefined) {
    return null;
  }

  return (
    <div ref={containerRef} className={styles.sidebarWrapper}>
      {containerElement && (
        <Resizable
          enable={{
            right: true,
          }}
          handleClasses={{ right: dragStyles.dragHandleVertical }}
          size={{ width: sidebarWidth, height: height }}
          defaultSize={{ width: sidebarWidth, height: height }}
          minWidth={FIELD_SELECTOR_MIN_WIDTH}
          maxWidth={tableWidth * 0.8}
          onResize={handleResize}
        >
          <LogsTableFieldSelector
            clear={() => {
              onDisplayedFieldsChange(defaultDisplayedFields);
            }}
            columnsWithMeta={columnsWithMeta}
            dataFrames={[dataFrame]}
            reorder={onDisplayedFieldsChange}
            setSidebarWidth={onSidebarWidthChange}
            sidebarWidth={sidebarWidth}
            toggle={(key: string) => {
              if (displayedFields.includes(key)) {
                onDisplayedFieldsChange(displayedFields.filter((f) => f !== key));
              } else {
                onDisplayedFieldsChange([...displayedFields, key]);
              }
            }}
          />
        </Resizable>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, sidebarWidth: number, height: number) => {
  return {
    sidebarWrapper: css({
      position: 'absolute',
      height: height,
      width: sidebarWidth,
    }),
  };
};
