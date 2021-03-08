import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Alert, LoadingPlaceholder, useStyles } from '@grafana/ui';
import React, { FC, useEffect } from 'react';
import { Namespace } from './Namespace';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { initialAsyncRequestState } from '../../utils/redux';
import { useDispatch } from 'react-redux';
import { fetchRulesAction } from '../../state/actions';

interface Props {
  datasourceName: string;
}

export const RulesSource: FC<Props> = ({ datasourceName }) => {
  const styles = useStyles(getStyles);
  const dispatch = useDispatch();
  const { error, result, loading } =
    useUnifiedAlertingSelector((state) => state.rules)[datasourceName] || initialAsyncRequestState;
  useEffect(() => {
    dispatch(fetchRulesAction(datasourceName));
  }, []);

  return (
    <section className={styles.wrapper}>
      <h5>System or application - {datasourceName}</h5>
      {!result && loading && <LoadingPlaceholder text="Loading rules..." />}
      {error && <Alert title={`Error loading rules: ${error.message || 'Unknown error.'}`} severity="error" />}
      {result?.map((ns) => (
        <Namespace key={ns.name} namespace={ns} />
      ))}
      {result?.length === 0 && <p>No rules found.</p>}
    </section>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    margin-bottom: ${theme.spacing.xl};
  `,
});
