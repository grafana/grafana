import React, { useCallback, useState } from 'react';
import { css } from '@emotion/css';
import { useFormContext } from 'react-hook-form';
import { Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { dateTimeFormatISO, getDefaultTimeRange, GrafanaTheme2, LoadingState } from '@grafana/data';
import { RuleFormType } from '../../types/rule-form';
import { PreviewRuleRequest, PreviewRuleResponse } from '../../types/preview';
import { previewAlertRule } from '../../api/preview';
import { PreviewRuleResult } from './PreviewRuleResult';
import { toDataQueryError } from '@grafana/runtime';

const fields: string[] = ['type', 'dataSourceName', 'condition', 'queries', 'expression'];

export function PreviewRule(): React.ReactElement | null {
  const [preview, setPreview] = useState<PreviewRuleResponse | undefined>();
  const styles = useStyles2(getStyles);
  const { getValues } = useFormContext();
  const [type] = getValues(fields);

  const onPreview = useCallback(async () => {
    const values = getValues(fields);

    try {
      const request = createPreviewRequest(values);
      setPreview(emptyPreview(LoadingState.Loading, values));
      const response = await previewAlertRule(request);
      setPreview(response);
    } catch (error) {
      const errorPreview = emptyPreview(LoadingState.Error, values);
      errorPreview.data.error = toDataQueryError(error);
      setPreview(errorPreview);
    }
  }, [getValues]);

  if (type === RuleFormType.cloud) {
    return null;
  }

  return (
    <div className={styles.container}>
      <HorizontalGroup>
        <Button type="button" variant="primary" onClick={onPreview}>
          Preview your alert
        </Button>
      </HorizontalGroup>
      <PreviewRuleResult preview={preview} />
    </div>
  );
}

function emptyPreview(state: LoadingState, values: any[]): PreviewRuleResponse {
  const [type] = values;

  return {
    ruleType: type,
    data: {
      state,
      series: [],
      timeRange: getDefaultTimeRange(),
    },
  };
}

function createPreviewRequest(values: any[]): PreviewRuleRequest {
  const [type, dataSourceName, condition, queries, expression] = values;

  switch (type) {
    case RuleFormType.cloud:
      return {
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

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      margin-top: ${theme.spacing(2)};
    `,
  };
}
