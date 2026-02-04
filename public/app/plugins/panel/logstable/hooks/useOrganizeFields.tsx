import { useEffect, useState } from 'react';
import useMountedState from 'react-use/lib/useMountedState';
import { lastValueFrom } from 'rxjs';

import { DataFrame, transformDataFrame } from '@grafana/data';
import { CustomCellRendererProps, TableCellDisplayMode } from '@grafana/ui';
import { LogsFrame } from 'app/features/logs/logsFrame';

import { LogsTableCustomCellRenderer } from '../cells/LogsTableCustomCellRenderer';
import { getFieldWidth } from '../fields/getFieldWidth';
import { doesFieldSupportAdHocFiltering, doesFieldSupportInspector } from '../fields/supports';
import { getDisplayedFields } from '../options/getDisplayedFields';
import { defaultOptions } from '../panelcfg.gen';
import { organizeLogsFieldsTransform } from '../transforms/organizeLogsFieldsTransform';
import { BuildLinkToLogLine, isBuildLinkToLogLine } from '../types';

interface Props {
  extractedFrame: DataFrame | null;
  timeFieldName: string;
  bodyFieldName: string;
  displayedFields: string[];
  logsFrame: LogsFrame | null;
  supportsPermalink: boolean;
  onPermalinkClick: BuildLinkToLogLine;
  showCopyLogLink: boolean;
  showInspectLogLine: boolean;
}

export function useOrganizeFields({
  extractedFrame,
  timeFieldName,
  bodyFieldName,
  logsFrame,
  supportsPermalink,
  onPermalinkClick,
  displayedFields,
  showCopyLogLink,
  showInspectLogLine,
}: Props) {
  const [organizedFrame, setOrganizedFrame] = useState<DataFrame | null>(null);
  const isMounted = useMountedState();

  /**
   * Organize fields transform
   */
  useEffect(() => {
    if (!extractedFrame || !timeFieldName || !bodyFieldName || !logsFrame) {
      return;
    }

    organizeFields(
      extractedFrame,
      logsFrame,
      timeFieldName,
      bodyFieldName,
      supportsPermalink,
      onPermalinkClick,
      getDisplayedFields(displayedFields, timeFieldName, bodyFieldName),
      showCopyLogLink ?? defaultOptions.showCopyLogLink ?? false,
      showInspectLogLine ?? defaultOptions.showInspectLogLine ?? false
    )
      .then((frame) => {
        if (frame && isMounted()) {
          setOrganizedFrame(frame);
        }
      })
      .catch((err) => {
        console.error('LogsTable: Organize fields transform error', err);
      });
  }, [
    bodyFieldName,
    extractedFrame,
    timeFieldName,
    logsFrame,
    supportsPermalink,
    onPermalinkClick,
    isMounted,
    displayedFields,
    showCopyLogLink,
    showInspectLogLine,
  ]);

  return { organizedFrame };
}

const organizeFields = async (
  extractedFrame: DataFrame,
  logsFrame: LogsFrame,
  timeFieldName: string,
  bodyFieldName: string,
  supportsPermalink: boolean,
  onPermalinkClick: BuildLinkToLogLine,
  displayedFields: string[],
  showCopyLogLink: boolean,
  showInspectLogLine: boolean
) => {
  if (!extractedFrame) {
    return Promise.resolve(null);
  }

  let indexByName: Record<string, number> = {};
  let includeByName: Record<string, boolean> = {};
  for (const [idx, field] of displayedFields.entries()) {
    indexByName[field] = idx;
    includeByName[field] = true;
  }

  const organizedFrame = await lastValueFrom(
    transformDataFrame(organizeLogsFieldsTransform(indexByName, includeByName), [extractedFrame])
  );

  for (let frameIndex = 0; frameIndex < organizedFrame.length; frameIndex++) {
    const frame = organizedFrame[frameIndex];
    for (const [fieldIndex, field] of frame.fields.entries()) {
      const isFirstField = fieldIndex === 0;
      field.config = {
        ...field.config,
        filterable: field.config?.filterable ?? doesFieldSupportAdHocFiltering(field, timeFieldName, bodyFieldName),
        custom: {
          ...field.config.custom,
          width: getFieldWidth(
            field.config.custom?.width,
            field,
            fieldIndex,
            timeFieldName,
            showCopyLogLink,
            showInspectLogLine
          ),
          inspect: field.config?.custom?.inspect ?? doesFieldSupportInspector(field),
          cellOptions:
            isFirstField && bodyFieldName && (supportsPermalink || showInspectLogLine)
              ? {
                  type: TableCellDisplayMode.Custom,
                  cellComponent: (cellProps: CustomCellRendererProps) => (
                    <LogsTableCustomCellRenderer
                      logsFrame={logsFrame}
                      supportsPermalink={supportsPermalink}
                      cellProps={cellProps}
                      showInspectLogLine={showInspectLogLine}
                      showCopyLogLink={showCopyLogLink}
                      buildLinkToLog={isBuildLinkToLogLine(onPermalinkClick) ? onPermalinkClick : onPermalinkClick}
                    />
                  ),
                }
              : undefined,
        },
      };
    }
  }

  return organizedFrame[0];
};
