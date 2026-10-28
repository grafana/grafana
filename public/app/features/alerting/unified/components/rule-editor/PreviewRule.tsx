import { css } from '@emotion/css';
import * as React from 'react';
import { useCallback, useState } from 'react';
import { type FieldPathValues, useFormContext } from 'react-hook-form';
import { useMountedState } from 'react-use';
import { takeWhile } from 'rxjs/operators';

import { type GrafanaTheme2, LoadingState, dateTimeFormatISO } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack, useStyles2 } from '@grafana/ui';

import { previewAlertRule } from '../../api/preview';
import { getAlertQueriesStatus, useAlertQueryDataSources } from '../../hooks/alertQueriesStatus';
import { type PreviewRuleRequest, type PreviewRuleResponse } from '../../types/preview';
import { RuleFormType, type RuleFormValues } from '../../types/rule-form';
import { isDataSourceManagedRuleByType } from '../../utils/rules';

import { PreviewRuleResult } from './PreviewRuleResult';

const fields = ['type', 'dataSourceName', 'condition', 'queries', 'expression'] as const satisfies ReadonlyArray<
  keyof RuleFormValues
>;
type PreviewRuleValues = FieldPathValues<RuleFormValues, typeof fields>;

export function PreviewRule(): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  const [preview, onPreview] = usePreview();
  const { watch } = useFormContext<RuleFormValues>();
  const [type, condition, queries] = watch(['type', 'condition', 'queries']);
  const { dataSourcesByUid, isLoading: isDsLoading } = useAlertQueryDataSources(queries);
  const { allDataSourcesAvailable } = getAlertQueriesStatus(queries, dataSourcesByUid);

  if (!type || isDataSourceManagedRuleByType(type)) {
    return null;
  }

  const isPreviewAvailable = Boolean(condition) && !isDsLoading && allDataSourcesAvailable;

  return (
    <div className={styles.container}>
      <Stack>
        {(isDsLoading || allDataSourcesAvailable) && (
          <Button
            disabled={!isPreviewAvailable}
            type="button"
            variant="primary"
            icon={isDsLoading ? 'spinner' : undefined}
            onClick={onPreview}
          >
            <Trans i18nKey="alerting.preview-rule.preview-alerts">Preview alerts</Trans>
          </Button>
        )}
        {!isDsLoading && !allDataSourcesAvailable && (
          <Alert
            title={t('alerting.preview-rule.title-preview-is-not-available', 'Preview is not available')}
            severity="warning"
          >
            <Trans i18nKey="alerting.preview-rule.body-preview-is-not-available">
              Cannot display the query preview. Some of the data sources used in the queries are not available.
            </Trans>
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

function createPreviewRequest(values: PreviewRuleValues): PreviewRuleRequest {
  const [type, dataSourceName, condition, queries, expression] = values;

  switch (type) {
    case RuleFormType.cloudAlerting: {
      // The cloud data source picker writes the selected data source uid into the first query.
      const dataSourceUid = queries[0]?.datasourceUid;
      if (!dataSourceUid) {
        throw new Error(`Cannot find data source settings for ${dataSourceName}`);
      }

      return {
        dataSourceUid,
        expr: expression,
      };
    }

    case RuleFormType.grafana:
      if (!condition) {
        throw new Error('Cannot preview a Grafana-managed rule without a condition');
      }

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
