import { useEffect, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { DataFrame, transformDataFrame } from '@grafana/data';
import { CustomCellRendererProps, TableCellDisplayMode } from '@grafana/ui';
import { LogsFrame } from 'app/features/logs/logsFrame';

import { LogsTableCustomCellRenderer } from '../cells/CustomCellRenderer';
import { getFieldWidth } from '../fields/gets';
import { doesFieldSupportAdHocFiltering, doesFieldSupportInspector } from '../fields/supports';
import type { Options as LogsTableOptions } from '../panelcfg.gen';
import { BuildLinkToLogLine, isBuildLinkToLogLine } from '../types';

interface Props {
  extractedFrame: DataFrame | null;
  timeFieldName: string;
  bodyFieldName: string;
  options: LogsTableOptions;
  logsFrame: LogsFrame | null;
  supportsPermalink: boolean;
  onPermalinkClick: BuildLinkToLogLine;
}

export function useOrganizeFields({
  extractedFrame,
  timeFieldName,
  bodyFieldName,
  logsFrame,
  supportsPermalink,
  onPermalinkClick,
  options,
}: Props) {
  const [organizedFrame, setOrganizedFrame] = useState<DataFrame | null>(null);

  /**
   * Organize fields transform
   */
  useEffect(() => {
    if (!extractedFrame || !timeFieldName || !bodyFieldName || !logsFrame) {
      return;
    }
    const showPermalinkButton = supportsPermalink && !!options.showCopyLogLink;
    console.log('useOrganizeFields', {
      bodyFieldName,
      extractedFrame,
      options,
      timeFieldName,
      logsFrame,
      showPermalinkButton,
    });

    organizeFields(
      extractedFrame,
      options,
      logsFrame,
      timeFieldName,
      bodyFieldName,
      showPermalinkButton,
      onPermalinkClick
    ).then((frame) => {
      if (frame) {
        setOrganizedFrame(frame);
      }
    });
  }, [bodyFieldName, extractedFrame, options, timeFieldName, logsFrame, supportsPermalink, onPermalinkClick]);

  return { organizedFrame };
}

const organizeFields = async (
  extractedFrame: DataFrame,
  options: LogsTableOptions,
  logsFrame: LogsFrame,
  timeFieldName: string,
  bodyFieldName: string,
  showPermalinkButton: boolean,
  onPermalinkClick: BuildLinkToLogLine
) => {
  if (!extractedFrame) {
    return Promise.resolve(null);
  }

  const displayedFields = options.displayedFields ?? [timeFieldName, bodyFieldName];

  let indexByName: Record<string, number> = {};
  let includeByName: Record<string, boolean> = {};
  for (const [idx, field] of displayedFields.entries()) {
    indexByName[field] = idx;
    includeByName[field] = true;
  }

  const organizedFrame = await lastValueFrom(
    transformDataFrame(
      [
        {
          id: 'organize',
          options: {
            indexByName,
            includeByName,
          },
        },
      ],
      [extractedFrame]
    )
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
          width: getFieldWidth(field.config.custom?.width, field, fieldIndex, timeFieldName, options),
          inspect: field.config?.custom?.inspect ?? doesFieldSupportInspector(field),
          cellOptions:
            isFirstField && bodyFieldName && (showPermalinkButton || options.showInspectLogLine)
              ? {
                  type: TableCellDisplayMode.Custom,
                  cellComponent: (cellProps: CustomCellRendererProps) => (
                    <LogsTableCustomCellRenderer
                      logsFrame={logsFrame}
                      showCopyLogLink={showPermalinkButton}
                      showInspectLogLine={options.showInspectLogLine ?? true}
                      cellProps={cellProps}
                      options={options}
                      bodyFieldName={bodyFieldName}
                      buildLinkToLog={
                        isBuildLinkToLogLine(options.buildLinkToLogLine) ? options.buildLinkToLogLine : onPermalinkClick
                      }
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
