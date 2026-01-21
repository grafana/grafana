import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';
import { LogsFrame } from 'app/features/logs/logsFrame';

import { DEFAULT_SIDEBAR_WIDTH } from './constants';
import { LogsTableFieldSelector } from './fieldSelector/FieldSelector';
import { buildColumnsWithMeta } from './fieldSelector/buildColumnsWithMeta';

interface Props {
  width: number | undefined;
  height: number;
  dataFrame: DataFrame;
  displayedFields: string[] | undefined;
  onDisplayedFieldsChange: (displayedFields: string[]) => void;
  onWidthChange: (width: number) => void;
  logsFrame: LogsFrame;
  timeFieldName: string;
  bodyFieldName: string;
}

export function LogsTableFields({
  width,
  height,
  dataFrame,
  displayedFields,
  onDisplayedFieldsChange,
  timeFieldName,
  bodyFieldName,
  logsFrame,
  onWidthChange,
}: Props) {
  const sidebarWidth = width ?? DEFAULT_SIDEBAR_WIDTH;
  const styles = useStyles2(getStyles, sidebarWidth, height);

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

  console.log('render::LogsTableFields', width);

  return (
    <div className={styles.sidebarWrapper}>
      <LogsTableFieldSelector
        clear={() => {
          onDisplayedFieldsChange(defaultDisplayedFields);
        }}
        columnsWithMeta={columnsWithMeta}
        dataFrames={[dataFrame]}
        reorder={onDisplayedFieldsChange}
        setSidebarWidth={onWidthChange}
        sidebarWidth={sidebarWidth}
        toggle={(key: string) => {
          if (displayedFields.includes(key)) {
            onDisplayedFieldsChange(displayedFields.filter((f) => f !== key));
          } else {
            onDisplayedFieldsChange([...displayedFields, key]);
          }
        }}
      />
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
