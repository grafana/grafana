import { useState, useEffect } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  DataFrame,
  FieldConfigSource,
  TimeZone,
  transformDataFrame,
  useDataLinksContext,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';
import { replaceVariables } from '@grafana-plugins/loki/querybuilder/parsingUtils';

import { extractLogsFieldsTransform } from '../transforms/extractLogsFieldsTransform';

interface Props {
  rawTableFrame: DataFrame | null;
  fieldConfig?: FieldConfigSource;
  timeZone: TimeZone;
}

export function useExtractFields({ rawTableFrame, fieldConfig, timeZone }: Props) {
  const dataLinksContext = useDataLinksContext();
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

    extractFields().then((data) => {
      const extractedFrames = applyFieldOverrides({
        data,
        fieldConfig,
        replaceVariables: replaceVariables ?? getTemplateSrv().replace.bind(getTemplateSrv()),
        theme,
        timeZone,
        dataLinkPostProcessor,
      });
      setExtractedFrame(extractedFrames[0]);
    });
    // @todo hook re-renders unexpectedly when data frame isn't changing if we add `rawTableFrame` as dependency, so we check for changes in the timestamps instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLinkPostProcessor, fieldConfig, rawTableFrame?.fields[1]?.values, theme, timeZone]);

  return { extractedFrame };
}
