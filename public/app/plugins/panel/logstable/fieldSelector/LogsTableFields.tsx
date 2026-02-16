import { css } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DataFrame, GrafanaTheme2, store } from '@grafana/data';
import { getDragStyles, useStyles2 } from '@grafana/ui';
import { FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';
import { SETTING_KEY_ROOT } from 'app/features/explore/Logs/utils/logs';
import {
  FIELD_SELECTOR_MIN_WIDTH,
  getDefaultFieldSelectorWidth,
} from 'app/features/logs/components/fieldSelector/FieldSelector';
import { LogsTableFieldSelector } from 'app/features/logs/components/fieldSelector/LogsTableFieldSelector';
import { reportInteractionOnce } from 'app/features/logs/components/panel/analytics';
import { LogsFrame } from 'app/features/logs/logsFrame';

import { buildColumnsWithMeta } from './buildColumnsWithMeta';

interface Props {
  fieldSelectorWidth: number | undefined;
  onFieldSelectorWidthChange: (width: number) => void;
  displayedFields: string[];
  onDisplayedFieldsChange: (displayedFields: string[]) => void;

  dataFrame: DataFrame;
  logsFrame: LogsFrame;

  tableWidth: number;
  height: number;
  timeFieldName: string;
  bodyFieldName: string;
}

export function LogsTableFields({
  tableWidth,
  fieldSelectorWidth = getDefaultFieldSelectorWidth(),
  height,
  dataFrame,
  displayedFields,
  onDisplayedFieldsChange,
  timeFieldName,
  bodyFieldName,
  logsFrame,
  onFieldSelectorWidthChange,
}: Props) {
  const styles = useStyles2(getStyles, fieldSelectorWidth, height);
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

  const setFieldSelectorWidthWrapper = useCallback(
    (width: number) => {
      onFieldSelectorWidthChange(width);
      // Getting value in getFieldSelectorWidth
      store.set(`${SETTING_KEY_ROOT}.fieldSelector.width`, width);
    },
    [onFieldSelectorWidthChange]
  );

  const handleResize: ResizeCallback = useCallback(
    (event, direction, ref) => {
      setFieldSelectorWidthWrapper(ref.clientWidth);
      reportInteractionOnce(`${SETTING_KEY_ROOT}.table.field_selector_resized`, {
        mode: 'logs',
      });
    },
    [setFieldSelectorWidthWrapper]
  );

  const toggleField = useCallback(
    (key: string) => {
      if (displayedFields.includes(key)) {
        onDisplayedFieldsChange(displayedFields.filter((f) => f !== key));
      } else {
        onDisplayedFieldsChange([...displayedFields, key]);
      }
    },
    [displayedFields, onDisplayedFieldsChange]
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
    <div ref={containerRef} className={styles.fieldSelectorWrapper}>
      {containerElement && (
        <Resizable
          enable={{
            right: true,
          }}
          handleClasses={{ right: dragStyles.dragHandleVertical }}
          size={{ width: fieldSelectorWidth, height: height }}
          defaultSize={{ width: fieldSelectorWidth, height: height }}
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
            setWidth={onFieldSelectorWidthChange}
            width={fieldSelectorWidth}
            toggle={toggleField}
          />
        </Resizable>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, fieldSelectorWidth: number, height: number) => {
  return {
    fieldSelectorWrapper: css({
      position: 'absolute',
      height: height,
      width: fieldSelectorWidth,
      zIndex: 1,
    }),
  };
};
