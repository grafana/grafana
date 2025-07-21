import { css } from '@emotion/css';
import { useState, useMemo, useEffect } from 'react';
import { useAsyncFn, useDebounce } from 'react-use';

import { formattedValueToString, getValueFormat, TimeRange } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Spinner, useTheme2 } from '@grafana/ui';

import { DB, SQLQuery, ValidationResults } from '../../types';

export interface QueryValidatorProps {
  db: DB;
  query: SQLQuery;
  range?: TimeRange;
  onValidate: (isValid: boolean) => void;
}

export function QueryValidator({ db, query, onValidate, range }: QueryValidatorProps) {
  const [validationResult, setValidationResult] = useState<ValidationResults | null>();
  const theme = useTheme2();
  const valueFormatter = useMemo(() => getValueFormat('bytes'), []);

  const styles = useMemo(() => {
    return {
      error: css({
        color: theme.colors.error.text,
        fontSize: theme.typography.bodySmall.fontSize,
        fontFamily: theme.typography.fontFamilyMonospace,
      }),
      valid: css({
        color: theme.colors.success.text,
      }),
      info: css({
        color: theme.colors.text.secondary,
      }),
    };
  }, [theme]);

  const [state, validateQuery] = useAsyncFn(
    async (q: SQLQuery) => {
      if (q.rawSql?.trim() === '') {
        return null;
      }

      return await db.validateQuery(q, range);
    },
    [db]
  );

  const [,] = useDebounce(
    async () => {
      const result = await validateQuery(query);
      if (result) {
        setValidationResult(result);
      }

      return null;
    },
    1000,
    [query, validateQuery]
  );

  useEffect(() => {
    if (validationResult?.isError) {
      onValidate(false);
    }
    if (validationResult?.isValid) {
      onValidate(true);
    }
  }, [validationResult, onValidate]);

  if (!state.value && !state.loading) {
    return null;
  }

  const error = state.value?.error ? processErrorMessage(state.value.error) : '';

  return (
    <>
      {state.loading && (
        <div className={styles.info}>
          <Spinner inline={true} size="xs" />{' '}
          <Trans i18nKey="grafana-sql.components.query-validator.validating-query">Validating query...</Trans>
        </div>
      )}
      {!state.loading && state.value && (
        <>
          <>
            {state.value.isValid && state.value.statistics && (
              <div className={styles.valid}>
                <Trans
                  i18nKey="grafana-sql.components.query-validator.query-will-process"
                  values={{ bytes: formattedValueToString(valueFormatter(state.value.statistics.TotalBytesProcessed)) }}
                >
                  <Icon name="check" /> This query will process <strong>{'{{bytes}}'}</strong> when run.
                </Trans>
              </div>
            )}
          </>

          <>{state.value.isError && <div className={styles.error}>{error}</div>}</>
        </>
      )}
    </>
  );
}

function processErrorMessage(error: string) {
  const splat = error.split(':');
  if (splat.length > 2) {
    return splat.slice(2).join(':');
  }
  return error;
}
