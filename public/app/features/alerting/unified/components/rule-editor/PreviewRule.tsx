import { css } from '@emotion/css';
import * as React from 'react';
import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useMountedState } from 'react-use';
import { takeWhile } from 'rxjs/operators';

import { GrafanaTheme2, LoadingState, dateTimeFormatISO } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Alert, Button, Stack, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { previewAlertRule } from '../../api/preview';
import { useAlertQueriesStatus } from '../../hooks/useAlertQueriesStatus';
import { PreviewRuleRequest, PreviewRuleResponse } from '../../types/preview';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { isDataSourceManagedRuleByType } from '../../utils/rules';

import { PreviewRuleResult } from './PreviewRuleResult';

const fields: Array<keyof RuleFormValues> = ['type', 'dataSourceName', 'condition', 'queries', 'expression'];

export function PreviewRule(): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  const [preview, onPreview] = usePreview();
  const { watch } = useFormContext<RuleFormValues>();
  const [type, condition, queries] = watch(['type', 'condition', 'queries']);
  const { allDataSourcesAvailable } = useAlertQueriesStatus(queries);

  if (!type || isDataSourceManagedRuleByType(type)) {
    return null;
  }

  const isPreviewAvailable = Boolean(condition) && allDataSourcesAvailable;

  return (
    <div className={styles.container}>
      <Stack>
        {allDataSourcesAvailable && (
          <Button disabled={!isPreviewAvailable} type="button" variant="primary" onClick={onPreview}>
            <Trans i18nKey="alerting.preview-rule.preview-alerts">Preview alerts</Trans>
          </Button>
        )}
        {!allDataSourcesAvailable && (
          <Alert
            title={t('alerting.preview-rule.title-preview-is-not-available', 'Preview is not available')}
            severity="warning"
          >
            Cannot display the query preview. Some of the data sources used in the queries are not available.
          </Alert>
        )}
      </Stack>
      <PreviewRuleResult preview={preview} />
    </div>
  );
}

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

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      marginTop: theme.spacing(2),
      maxWidth: `${theme.breakpoints.values.xxl}px`,
    }),
  };
}
