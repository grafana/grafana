import { useCallback, useEffect, useMemo } from 'react';

import {
  applyFieldOverrides,
  type DataFrame,
  type FieldConfigSource,
  type InterpolateFunction,
  type PanelData,
  type TimeZone,
  useDataLinksContext,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { type DataTransformerConfig } from '@grafana/schema';
import { useAdHocTransformations, useTheme2, useTransformedData } from '@grafana/ui';

import { LOG_LINE_BODY_FIELD_NAME } from '../../../../features/logs/components/fieldSelector/logFields';
import { getLogsTableFieldConfigRegistry } from '../logsTableFieldConfig';
import { getDisplayedFields } from '../options/getDisplayedFields';
import type { Options as LogsTableOptions } from '../panelcfg.gen';
import { extractLogsFieldsTransform } from '../transforms/extractLogsFieldsTransform';
import { organizeLogsFieldsTransform } from '../transforms/organizeLogsFieldsTransform';

interface Props {
  data: PanelData;
  rawTableFrame: DataFrame | null;
  frameIndex: number;
  fieldConfig: FieldConfigSource;
  timeZone: TimeZone;
  replaceVariables?: InterpolateFunction;
  options: LogsTableOptions;
  timeFieldName: string;
  levelFieldName: string;
  bodyFieldName: string;
}

/** Compares two pipelines by what they do, ignoring the provenance stamp `replaceAdHoc` adds. */
function pipelineKey(configs: DataTransformerConfig[]): string {
  return JSON.stringify(configs.map(({ id, options }) => ({ id, options })));
}

/**
 * Runs the panel's two transformations through the panel's transformation pipeline rather than
 * locally, so they are visible and editable in the transformations editor and so user-authored
 * transformations can sit between them.
 *
 * Order matters and is the reason this uses `replaceAdHoc({ before, after })`:
 *
 *   extractFields -> (whatever the user added) -> organize
 *
 * Extracting first is what lets a user transformation reference a label column at all; organizing
 * last is what lets the column selection apply to fields a user transformation created.
 *
 * Both entries are derived — from the shape of the data and from `options.displayedFields` — so
 * they are rewritten whenever those change, including if the user deletes them from the editor.
 */
export function useLogsTableTransformations({
  data,
  rawTableFrame,
  frameIndex,
  fieldConfig,
  timeZone,
  replaceVariables,
  options,
  timeFieldName,
  levelFieldName,
  bodyFieldName,
}: Props) {
  const theme = useTheme2();
  const { dataLinkPostProcessor } = useDataLinksContext();
  const { transformations, adHocTransformations, replaceAdHoc } = useAdHocTransformations();

  /**
   * The panel applies field config itself rather than through `PanelContext.applyFieldConfig`,
   * because it needs its own registry and the `custom.filterable` / `custom.wrapText` defaults it
   * synthesizes in `fieldConfig`. Going through `applyFieldOverrides` keeps those overridable
   * per field, which forcing them afterwards would not. It is also the only field config the
   * panel gets in Explore, which provides no host implementation.
   */
  const applyFieldConfig = useCallback(
    (panelData: PanelData): PanelData => ({
      ...panelData,
      series: applyFieldOverrides({
        data: panelData.series,
        fieldConfig,
        fieldConfigRegistry: getLogsTableFieldConfigRegistry(),
        replaceVariables: replaceVariables ?? getTemplateSrv().replace.bind(getTemplateSrv()),
        theme,
        timeZone,
        dataLinkPostProcessor,
      }),
    }),
    [dataLinkPostProcessor, fieldConfig, replaceVariables, theme, timeZone]
  );

  // Which JSON column to explode depends on the frame, so this can only be built once data arrives.
  const before = useMemo(() => (rawTableFrame ? extractLogsFieldsTransform(rawTableFrame) : []), [rawTableFrame]);

  const after = useMemo(() => {
    const indexByName: Record<string, number> = {};
    const includeByName: Record<string, boolean> = {};

    for (let [idx, field] of getDisplayedFields(options, timeFieldName, levelFieldName).entries()) {
      // interop with logs panel
      if (field === LOG_LINE_BODY_FIELD_NAME) {
        field = bodyFieldName;
      }
      indexByName[field] = idx;
      includeByName[field] = true;
    }

    return organizeLogsFieldsTransform(indexByName, includeByName);
  }, [bodyFieldName, levelFieldName, options, timeFieldName]);

  useEffect(() => {
    // Nothing to derive the extract config from yet; leave whatever was persisted alone rather
    // than writing a pipeline that would only be corrected on the next render.
    if (!rawTableFrame) {
      return;
    }

    // Compared against the whole pipeline, not just the panel's own entries, so that dragging a row
    // in the transformations editor past one of them is corrected too. `replaceAdHoc` produces
    // exactly this arrangement, so the comparison is idempotent and settles after one write.
    const editorEntries = transformations.filter((t) => !adHocTransformations.includes(t));

    if (pipelineKey(transformations) !== pipelineKey([...before, ...editorEntries, ...after])) {
      replaceAdHoc({ before, after });
    }
  }, [transformations, adHocTransformations, before, after, rawTableFrame, replaceAdHoc]);

  const { data: transformedData, dataBeforeTrailing } = useTransformedData(data, {
    // Passed explicitly because this hook holds the pipeline when the host provides none.
    transformations,
    splitTrailing: after.length,
    applyFieldConfig,
  });

  return {
    /** Transformed, field-config'd data for the table. */
    data: transformedData,
    /**
     * The frame as it was before `organize`, which still carries every available field. The field
     * selector builds its list of selectable columns from this; the table's own frame only has the
     * columns that are already displayed.
     */
    availableFieldsFrame: dataBeforeTrailing?.series[frameIndex] ?? null,
  };
}
