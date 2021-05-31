import React, { useCallback, useState } from 'react';
import { css } from '@emotion/css';
import { useFormContext } from 'react-hook-form';
import { takeWhile } from 'rxjs/operators';
import { useMountedState } from 'react-use';
import { Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { dateTimeFormatISO, GrafanaTheme2, LoadingState } from '@grafana/data';
import { RuleFormType } from '../../types/rule-form';
import { PreviewRuleRequest, PreviewRuleResponse } from '../../types/preview';
import { previewAlertRule } from '../../api/preview';
import { PreviewRuleResult } from './PreviewRuleResult';

const fields: string[] = ['type', 'dataSourceName', 'condition', 'queries', 'expression'];

export function PreviewRule(): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  const [preview, onPreview] = usePreview();
  const { getValues } = useFormContext();
  const [type] = getValues(fields);

  if (type === RuleFormType.cloud) {
    return null;
  }

  return (
    <div className={styles.container}>
      <HorizontalGroup>
        <Button type="button" variant="primary" onClick={onPreview}>
          Preview alerts
        </Button>
      </HorizontalGroup>
      <PreviewRuleResult preview={preview} />
    </div>
  );
}

function usePreview(): [PreviewRuleResponse | undefined, () => void] {
  const [preview, setPreview] = useState<PreviewRuleResponse | undefined>();
  const { getValues } = useFormContext();
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

function isCompleted(response: PreviewRuleResponse): boolean {
  switch (response.data.state) {
    case LoadingState.Done:
    case LoadingState.Error:
      return true;
    default:
      return false;
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      margin-top: ${theme.spacing(2)};
    `,
  };
}
