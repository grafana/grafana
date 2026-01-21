import { css } from '@emotion/css';
import { useCallback, useEffect, useState, useMemo } from 'react';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';
import { LogsTableFieldSelector } from 'app/features/logs/components/fieldSelector/FieldSelector';
import { LogsFrame } from 'app/features/logs/logsFrame';

import { buildColumnsWithMeta } from './buildColumnsWithMeta';
import { DEFAULT_SIDEBAR_WIDTH } from './constants';

interface Props {
  height: number;
  dataFrames: DataFrame[];
  displayedFields: string[] | undefined;
  onDisplayedFieldsChange: (displayedFields: string[]) => void;
  logsFrame: LogsFrame;
  timeFieldName: string;
  bodyFieldName: string;
}

export function LogsTableFields({
  height,
  dataFrames,
  displayedFields,
  onDisplayedFieldsChange,
  timeFieldName,
  bodyFieldName,
  logsFrame,
}: Props) {
  const styles = useStyles2(getStyles, DEFAULT_SIDEBAR_WIDTH, height);

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
        logsFrame.getLogFrameLabelsAsLabels(),
        displayedFields ?? defaultDisplayedFields
      )
    );
  }, [displayedFields, handleSetColumnsWithMeta, logsFrame, defaultDisplayedFields]);

  if (columnsWithMeta === null || displayedFields === undefined) {
    return null;
  }

  console.log('render::LogsTableFields');

  return (
    <div className={styles.sidebarWrapper}>
      <LogsTableFieldSelector
        clear={() => {
          onDisplayedFieldsChange(defaultDisplayedFields);
        }}
        columnsWithMeta={columnsWithMeta}
        dataFrames={dataFrames}
        reorder={(columns: string[]) => {
          onDisplayedFieldsChange(columns);
        }}
        setSidebarWidth={(width) => {
          console.log('setSidebarWidth (@todo)', width);
        }}
        sidebarWidth={DEFAULT_SIDEBAR_WIDTH}
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
