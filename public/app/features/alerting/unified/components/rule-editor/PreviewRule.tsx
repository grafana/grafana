import React, { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { dateTimeFormatISO, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { RuleFormType } from '../../types/rule-form';
import { PreviewRuleRequest, PreviewRuleResponse } from '../../types/preview';
import { previewAlertRule } from '../../api/preview';

const fields: string[] = ['type', 'dataSourceName', 'condition', 'queries', 'expression'];

export function PreviewRule(): React.ReactElement | null {
  const [result, setResult] = useState<PreviewRuleResponse | undefined>();
  const styles = useStyles2(getStyles);
  const { getValues } = useFormContext();

  const onPreview = useCallback(async () => {
    const values = getValues(fields);
    const request = createPreviewRequest(values);
    const response = await previewAlertRule(request);

    setResult(response);
  }, [getValues]);

  return (
    <div className={styles.container}>
      <HorizontalGroup>
        <Button type="button" variant="primary" onClick={onPreview}>
          Preview your alert
        </Button>
      </HorizontalGroup>
    </div>
  );
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
