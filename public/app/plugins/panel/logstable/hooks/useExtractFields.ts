import { useEffect, useState } from 'react';
import useMountedState from 'react-use/lib/useMountedState';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  type DataFrame,
  type FieldConfigSource,
  type InterpolateFunction,
  LoadingState,
  type TimeZone,
  transformDataFrame,
  useDataLinksContext,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';

import { getLogsTableFieldConfigRegistry } from '../logsTableFieldConfig';
import { extractLogsFieldsTransform } from '../transforms/extractLogsFieldsTransform';

interface Props {
  rawTableFrame: DataFrame | null;
  fieldConfig?: FieldConfigSource;
  timeZone: TimeZone;
  replaceVariables?: InterpolateFunction;
  loadingState: LoadingState;
  /**
   * Set to false when the host already ran the transformation this hook duplicates — the one
   * registered in `module.tsx` — so `rawTableFrame` arrives with the label columns and with field
   * overrides already applied to them. Extraction has to happen in exactly one place:
   * `extractFields` renames colliding columns rather than skipping them, so a second pass produces
   * `service 1`, `level 1`, and a second `applyFieldOverrides` re-pushes panel default data links
   * onto every field.
   */
  enabled?: boolean;
}

export function useExtractFields({
  rawTableFrame,
  fieldConfig,
  timeZone,
  replaceVariables,
  loadingState,
  enabled = true,
}: Props) {
  const dataLinksContext = useDataLinksContext();
  const isMounted = useMountedState();
  const dataLinkPostProcessor = dataLinksContext.dataLinkPostProcessor;
  const [extractedFrame, setExtractedFrame] = useState<DataFrame | null>(null);
  const theme = useTheme2();

  useEffect(() => {
    if (!enabled || !fieldConfig || loadingState === LoadingState.Loading) {
      return;
    }

    const extractFields = async () => {
      if (!rawTableFrame) {
        return Promise.resolve([]);
      }
      return await lastValueFrom(transformDataFrame(extractLogsFieldsTransform(rawTableFrame), [rawTableFrame]));
    };

    extractFields()
      .then((data) => {
        const extractedFrames = applyFieldOverrides({
          data,
          fieldConfig,
          fieldConfigRegistry: getLogsTableFieldConfigRegistry(),
          replaceVariables: replaceVariables ?? getTemplateSrv().replace.bind(getTemplateSrv()),
          theme,
          timeZone,
          dataLinkPostProcessor,
        });
        if (isMounted()) {
          setExtractedFrame(extractedFrames[0]);
        }
      })
      .catch((err) => {
        console.error('LogsTable: Extract fields transform error', err);
      });
  }, [
    dataLinkPostProcessor,
    enabled,
    fieldConfig,
    isMounted,
    loadingState,
    rawTableFrame,
    replaceVariables,
    theme,
    timeZone,
  ]);

  return { extractedFrame: enabled ? extractedFrame : rawTableFrame };
}
