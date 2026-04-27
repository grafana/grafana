import { merge } from 'lodash';
import { useEffect, useState } from 'react';
import useMountedState from 'react-use/lib/useMountedState';
import { lastValueFrom } from 'rxjs';

import { type FieldConfigSource, transformDataFrame } from '@grafana/data';
import { type DataFrame } from '@grafana/data/dataframe';
import { type CustomCellRendererProps, TableCellDisplayMode } from '@grafana/ui';
import { type LogsFrame } from 'app/features/logs/logsFrame';

import { LOG_LINE_BODY_FIELD_NAME } from '../../../../features/logs/components/fieldSelector/logFields';
import { LogsTableCustomCellRenderer } from '../cells/LogsTableCustomCellRenderer';
import { getLogLevelColumnEnhancements } from '../fields/defaultLogLevelColumnConfig';
import { getTimeFieldWidth } from '../fields/getFieldWidth';
import { normalizeLogLevelFieldInPlace } from '../fields/normalizeLogLevelField';
import { doesFieldSupportAdHocFiltering, doesFieldSupportInspector } from '../fields/supports';
import { getDisplayedFields } from '../options/getDisplayedFields';
import type { Options as LogsTableOptions } from '../panelcfg.gen';
import { organizeLogsFieldsTransform } from '../transforms/organizeLogsFieldsTransform';
import { type BuildLinkToLogLine, isBuildLinkToLogLine } from '../types';

interface Props {
  extractedFrame: DataFrame | null;
  timeFieldName: string;
  levelFieldName: string;
  bodyFieldName: string;
  options: LogsTableOptions;
  logsFrame: LogsFrame | null;
  supportsPermalink: boolean;
  onPermalinkClick: BuildLinkToLogLine;
  fieldConfig: FieldConfigSource;
}

export function useOrganizeFields({
  extractedFrame,
  timeFieldName,
  levelFieldName,
  bodyFieldName,
  logsFrame,
  supportsPermalink,
  onPermalinkClick,
  options,
  fieldConfig,
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
      options,
      logsFrame,
      timeFieldName,
      levelFieldName,
      bodyFieldName,
      supportsPermalink,
      onPermalinkClick,
      fieldConfig
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
    levelFieldName,
    extractedFrame,
    options,
    timeFieldName,
    logsFrame,
    supportsPermalink,
    onPermalinkClick,
    isMounted,
    fieldConfig,
  ]);

  return { organizedFrame };
}

const organizeFields = async (
  extractedFrame: DataFrame,
  options: LogsTableOptions,
  logsFrame: LogsFrame,
  timeFieldName: string,
  levelFieldName: string,
  bodyFieldName: string,
  supportsPermalink: boolean,
  onPermalinkClick: BuildLinkToLogLine,
  fieldConfig: FieldConfigSource
) => {
  if (!extractedFrame) {
    return Promise.resolve(null);
  }

  const displayedFields = getDisplayedFields(options, timeFieldName, levelFieldName);

  let indexByName: Record<string, number> = {};
  let includeByName: Record<string, boolean> = {};
  for (let [idx, field] of displayedFields.entries()) {
    // interop with logs panel
    if (field === LOG_LINE_BODY_FIELD_NAME) {
      field = bodyFieldName;
    }
    indexByName[field] = idx;
    includeByName[field] = true;
  }

  const organizedFrame = await lastValueFrom(
    transformDataFrame(organizeLogsFieldsTransform(indexByName, includeByName), [extractedFrame])
  );

  for (let frameIndex = 0; frameIndex < organizedFrame.length; frameIndex++) {
    const frame = organizedFrame[frameIndex];

    const levelField = frame.fields.find((f) => f.name === levelFieldName);
    let isLevelFirstField = false;
    if (levelField) {
      normalizeLogLevelFieldInPlace(levelField);
      isLevelFirstField = frame.fields.indexOf(levelField) === 0;
    }

    for (const [fieldIndex, field] of frame.fields.entries()) {
      const isFirstField = (!isLevelFirstField && fieldIndex === 0) || (isLevelFirstField && fieldIndex === 1);
      // Deep-merge so panel defaults (e.g. custom.filterable) survive when the field already has custom.* from applyFieldOverrides.
      const baseConfig = merge({}, fieldConfig.defaults, field.config);

      const levelEnhancements = getLogLevelColumnEnhancements(field, levelFieldName, baseConfig);

      const configAfterLevel = {
        ...baseConfig,
        ...(levelEnhancements?.mappings ? { mappings: levelEnhancements.mappings } : {}),
        custom: {
          ...baseConfig.custom,
          ...(levelEnhancements?.cellOptions ? { cellOptions: levelEnhancements.cellOptions } : {}),
          ...(levelEnhancements?.width !== undefined ? { width: levelEnhancements.width } : {}),
        },
      };

      // We are mutating fields. Would it be possible to avoid it?
      if (configAfterLevel.custom?.cellOptions?.cellComponent) {
        configAfterLevel.custom.cellOptions = undefined;
      }

      field.config = {
        ...configAfterLevel,
        filterable: field.config?.filterable ?? doesFieldSupportAdHocFiltering(field, timeFieldName, bodyFieldName),
        custom: {
          ...configAfterLevel.custom,
          width:
            field.name === timeFieldName
              ? getTimeFieldWidth(configAfterLevel.custom?.width, fieldIndex, options)
              : configAfterLevel.custom?.width,
          inspect: configAfterLevel.custom?.inspect ?? doesFieldSupportInspector(field),
          cellOptions:
            isFirstField && bodyFieldName && (supportsPermalink || options.enableLogDetails)
              ? {
                  type: TableCellDisplayMode.Custom,
                  cellComponent: (cellProps: CustomCellRendererProps) => (
                    <LogsTableCustomCellRenderer
                      logsFrame={logsFrame}
                      supportsPermalink={supportsPermalink}
                      cellProps={cellProps}
                      options={options}
                      buildLinkToLog={
                        isBuildLinkToLogLine(options.buildLinkToLogLine) ? options.buildLinkToLogLine : onPermalinkClick
                      }
                    />
                  ),
                }
              : configAfterLevel.custom?.cellOptions,
        },
      };
    }
  }

  return organizedFrame[0];
};
