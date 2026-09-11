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
}

export function useExtractFields({ rawTableFrame, fieldConfig, timeZone, replaceVariables, loadingState }: Props) {
  const dataLinksContext = useDataLinksContext();
  const isMounted = useMountedState();
  const dataLinkPostProcessor = dataLinksContext.dataLinkPostProcessor;
  const [extractedFrame, setExtractedFrame] = useState<DataFrame | null>(null);
  const theme = useTheme2();

  useEffect(() => {
    if (!fieldConfig || loadingState === LoadingState.Loading) {
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
  }, [dataLinkPostProcessor, fieldConfig, isMounted, loadingState, rawTableFrame, replaceVariables, theme, timeZone]);

  return { extractedFrame };
}
