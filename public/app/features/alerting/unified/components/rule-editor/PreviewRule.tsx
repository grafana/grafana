import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useMountedState } from 'react-use';
import { takeWhile } from 'rxjs/operators';

import { LoadingState, dateTimeFormatISO } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { previewAlertRule } from '../../api/preview';
import { PreviewRuleRequest, PreviewRuleResponse } from '../../types/preview';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';


const fields: Array<keyof RuleFormValues> = ['type', 'dataSourceName', 'condition', 'queries', 'expression'];

export function usePreview(): [PreviewRuleResponse | undefined, () => void] {
  const [preview, setPreview] = useState<PreviewRuleResponse | undefined>();
  const { getValues } = useFormContext<RuleFormValues>();
  const isMounted = useMountedState();

  const onPreview = useCallback(() => {
    const values = getValues(fields);
    const request = createPreviewRequest(values);

    previewAlertRule(request)
      .pipe(takeWhile((response) => !isCompleted(response), true))
      .subscribe((response) => {
        if (!isMounted()) {
          return;
        }
        setPreview(response);
      });
  }, [getValues, isMounted]);

  return [preview, onPreview];
}

function createPreviewRequest(values: any[]): PreviewRuleRequest {
  const [type, dataSourceName, condition, queries, expression] = values;
  const dsSettings = getDataSourceSrv().getInstanceSettings(dataSourceName);
  if (!dsSettings) {
    throw new Error(`Cannot find data source settings for ${dataSourceName}`);
  }

  switch (type) {
    case RuleFormType.cloudAlerting:
      return {
        dataSourceUid: dsSettings.uid,
        dataSourceName,
        expr: expression,
      };

    case RuleFormType.grafana:
      return {
        grafana_condition: {
          condition,
          data: queries,
          now: dateTimeFormatISO(Date.now()),
        },
      };

    default:
      throw new Error(`Alert type ${type} not supported by preview.`);
  }
}

function isCompleted(response: PreviewRuleResponse): boolean {
  switch (response.data.state) {
    case LoadingState.Done:
    case LoadingState.Error:
      return true;
    default:
      return false;
  }
}
