import { useEffect, useState } from 'react';
import useMountedState from 'react-use/lib/useMountedState';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  type DataFrame,
  type FieldConfigSource,
  type InterpolateFunction,
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
}

export function useExtractFields({ rawTableFrame, fieldConfig, timeZone, replaceVariables }: Props) {
  const dataLinksContext = useDataLinksContext();
  const isMounted = useMountedState();
  const dataLinkPostProcessor = dataLinksContext.dataLinkPostProcessor;
  const [extractedFrame, setExtractedFrame] = useState<DataFrame | null>(null);
  const theme = useTheme2();

  useEffect(() => {
    if (!fieldConfig) {
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
    // @todo hook re-renders unexpectedly when data frame isn't changing if we add `rawTableFrame` as dependency, so we check for changes in the timestamps instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLinkPostProcessor, fieldConfig, rawTableFrame?.fields[1]?.values, replaceVariables, theme, timeZone]);

  return { extractedFrame };
}
