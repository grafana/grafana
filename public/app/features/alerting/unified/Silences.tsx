import React, { FC, useEffect, useCallback } from 'react';
import { Alert, LoadingPlaceholder, Button, Field, useStyles, Link } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { useDispatch } from 'react-redux';
import { Redirect, Route, RouteChildrenProps, Switch, useLocation } from 'react-router-dom';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import SilencesTable from './components/silences/SilencesTable';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAmAlertsAction, fetchSilencesAction } from './state/actions';
import { SILENCES_POLL_INTERVAL_MS } from './utils/constants';
import { initialAsyncRequestState } from './utils/redux';
import SilencesEditor from './components/silences/SilencesEditor';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

const Silences: FC = () => {
  const [alertManagerSourceName = '', setAlertManagerSourceName] = useAlertManagerSourceName();
  const dispatch = useDispatch();
  const location = useLocation();
  const styles = useStyles(getStyles);
  const isRoot = location.pathname.endsWith('alerting/silences');
  const silences = useUnifiedAlertingSelector((state) => state.silences);

  const alerts =
    useUnifiedAlertingSelector((state) => state.amAlerts)[alertManagerSourceName] || initialAsyncRequestState;

  useEffect(() => {
    function fetchAll() {
      dispatch(fetchSilencesAction(alertManagerSourceName));
      dispatch(fetchAmAlertsAction(alertManagerSourceName));
    }
    fetchAll();
    const interval = setInterval(() => fetchAll, SILENCES_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [alertManagerSourceName, dispatch]);

  const { result, loading, error } = silences[alertManagerSourceName] || initialAsyncRequestState;
  const getSilenceById = useCallback((id: string) => result && result.find((silence) => silence.id === id), [result]);

  if (!alertManagerSourceName) {
    return <Redirect to="/alerting/silences" />;
  }

  return (
    <AlertingPageWrapper pageId="silences">
      <Field label="Choose alert manager">
        <AlertManagerPicker current={alertManagerSourceName} onChange={setAlertManagerSourceName} />
      </Field>
      {isRoot && (
        <Link href={`${config.appSubUrl ?? ''}/alerting/silence/new`}>
          <Button className={styles.addNewSilence} icon="plus">
            New Silence
          </Button>
        </Link>
      )}
      {error && !loading && (
        <Alert severity="error" title="Error loading silences">
          {error.message || 'Unknown error.'}
        </Alert>
      )}
      {loading && <LoadingPlaceholder text="loading silences..." />}
      {result && !error && alerts.result && (
        <Switch>
          <Route exact path="/alerting/silences">
            <SilencesTable
              silences={result}
              alertManagerAlerts={alerts.result}
              alertManagerSourceName={alertManagerSourceName}
            />
          </Route>
          <Route exact path="/alerting/silence/new">
            <SilencesEditor alertManagerSourceName={alertManagerSourceName} />
          </Route>
          <Route exact path="/alerting/silence/:id/edit">
            {({ match }: RouteChildrenProps<{ id: string }>) => {
              return (
                match?.params.id && (
                  <SilencesEditor
                    silence={getSilenceById(match.params.id)}
                    alertManagerSourceName={alertManagerSourceName}
                  />
                )
              );
            }}
          </Route>
        </Switch>
      )}
    </AlertingPageWrapper>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  addNewSilence: css`
    margin-bottom: ${theme.spacing.md};
  `,
});

export default Silences;
