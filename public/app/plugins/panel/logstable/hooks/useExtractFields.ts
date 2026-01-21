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
import { getLogsExtractFields } from 'app/plugins/panel/logstable/transforms/extractLogsFields';

interface Props {
  rawTableFrame: DataFrame;
  fieldConfig?: FieldConfigSource;
  timeZone: TimeZone;
}

export function useExtractFields({ rawTableFrame, fieldConfig, timeZone }: Props) {
  const dataLinksContext = useDataLinksContext();
  const dataLinkPostProcessor = dataLinksContext.dataLinkPostProcessor;
  const [extractedFrame, setExtractedFrame] = useState<DataFrame[] | null>(null);
  const theme = useTheme2();

  useEffect(() => {
    if (!fieldConfig) {
      return;
    }

    console.log('useExtractFields', { dataLinkPostProcessor, fieldConfig, rawTableFrame, theme, timeZone });
    const extractFields = async () => {
      return await lastValueFrom(transformDataFrame(getLogsExtractFields(rawTableFrame), [rawTableFrame]));
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
      setExtractedFrame(extractedFrames);
    });
  }, [dataLinkPostProcessor, fieldConfig, rawTableFrame, theme, timeZone]);

  return { extractedFrame };
}
