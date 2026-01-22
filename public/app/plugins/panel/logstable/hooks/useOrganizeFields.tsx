import { useEffect, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { DataFrame, transformDataFrame } from '@grafana/data';
import { CustomCellRendererProps, TableCellDisplayMode } from '@grafana/ui';

import { LogsTableCustomCellRenderer } from '../cells/CustomCellRenderer';
import { getFieldWidth } from '../fields/gets';
import { doesFieldSupportAdHocFiltering, doesFieldSupportInspector } from '../fields/supports';
import type { Options as LogsTableOptions } from '../panelcfg.gen';
import { isBuildLinkToLogLine } from '../types';

interface Props {
  extractedFrame: DataFrame | null;
  timeFieldName: string;
  bodyFieldName: string;
  options: LogsTableOptions;
}

export function useOrganizeFields({ extractedFrame, timeFieldName, bodyFieldName, options }: Props) {
  const [organizedFrame, setOrganizedFrame] = useState<DataFrame | null>(null);

  /**
   * Organize fields transform
   */
  useEffect(() => {
    if (!extractedFrame || !timeFieldName || !bodyFieldName) {
      return;
    }
    console.log('useOrganizeFields', { bodyFieldName, extractedFrame, options, timeFieldName });

    organizeFields(extractedFrame, options, timeFieldName, bodyFieldName).then((frame) => {
      if (frame) {
        setOrganizedFrame(frame);
      }
    });
  }, [bodyFieldName, extractedFrame, options, timeFieldName]);

  return { organizedFrame };
}

const organizeFields = async (
  extractedFrame: DataFrame,
  options: LogsTableOptions,
  timeFieldName: string,
  bodyFieldName: string
) => {
  if (!extractedFrame) {
    return Promise.resolve(null);
  }

  let indexByName: Record<string, number> = {};
  let includeByName: Record<string, boolean> = {};
  if (options.displayedFields) {
    for (const [idx, field] of options.displayedFields.entries()) {
      indexByName[field] = idx;
      includeByName[field] = true;
    }
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
            isFirstField && bodyFieldName && (options.showCopyLogLink || options.showInspectLogLine)
              ? {
                  type: TableCellDisplayMode.Custom,
                  cellComponent: (cellProps: CustomCellRendererProps) => (
                    <LogsTableCustomCellRenderer
                      showCopyLogLink={options.showCopyLogLink ?? false}
                      showInspectLogLine={options.showInspectLogLine ?? true}
                      cellProps={cellProps}
                      options={options}
                      bodyFieldName={bodyFieldName}
                      buildLinkToLog={
                        isBuildLinkToLogLine(options.buildLinkToLogLine) ? options.buildLinkToLogLine : undefined
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
