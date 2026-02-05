import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';
import { FIELD_SELECTOR_DEFAULT_WIDTH } from 'app/features/logs/components/fieldSelector/FieldSelector';
import { LogsFrame } from 'app/features/logs/logsFrame';

import { LogsTableFieldSelector } from './LogsTableFieldSelector';
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

// @todo take getSuggestedFields as prop and delete this component
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
  const [containerElement, setContainerRefState] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement) => {
    setContainerRefState(node);
  }, []);

  const defaultDisplayedFields = useMemo(() => [timeFieldName, bodyFieldName], [timeFieldName, bodyFieldName]);
  const [columnsWithMeta, setColumnsWithMeta] = useState<FieldNameMetaStore | null>(null);

  const handleSetColumnsWithMeta = useCallback((columnsWithMeta: FieldNameMetaStore) => {
    setColumnsWithMeta(columnsWithMeta);
  }, []);

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
        <LogsTableFieldSelector
          maxWidth={tableWidth * 0.8}
          clear={() => {
            onDisplayedFieldsChange(defaultDisplayedFields);
          }}
          columnsWithMeta={columnsWithMeta}
          dataFrame={dataFrame}
          reorder={onDisplayedFieldsChange}
          setSidebarWidth={onSidebarWidthChange}
          sidebarWidth={sidebarWidth}
          sidebarHeight={height}
          toggle={(key: string) => {
            if (displayedFields.includes(key)) {
              onDisplayedFieldsChange(displayedFields.filter((f) => f !== key));
            } else {
              onDisplayedFieldsChange([...displayedFields, key]);
            }
          }}
        />
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
