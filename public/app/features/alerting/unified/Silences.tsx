import React from 'react';
import { Route, RouteChildrenProps, Switch } from 'react-router-dom';

import { withErrorBoundary } from '@grafana/ui';
import {
  defaultsFromQuery,
  getDefaultSilenceFormValues,
} from 'app/features/alerting/unified/components/silences/utils';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import ExistingSilenceEditor, { SilencesEditor } from './components/silences/SilencesEditor';
import SilencesTable from './components/silences/SilencesTable';
import { useSilenceNavData } from './hooks/useSilenceNavData';
import { useAlertmanager } from './state/AlertmanagerContext';

const Silences = () => {
  const { selectedAlertmanager } = useAlertmanager();

  if (!selectedAlertmanager) {
    return null;
  }

  return (
    <>
      <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={selectedAlertmanager} />
      <Switch>
        <Route exact path="/alerting/silences">
          <SilencesTable alertManagerSourceName={selectedAlertmanager} />
        </Route>
        <Route exact path="/alerting/silence/new">
          {({ location }) => {
            const queryParams = new URLSearchParams(location.search);
            const formValues = getDefaultSilenceFormValues(defaultsFromQuery(queryParams));

            return <SilencesEditor formValues={formValues} alertManagerSourceName={selectedAlertmanager} />;
          }}
        </Route>
        <Route exact path="/alerting/silence/:id/edit">
          {({ match }: RouteChildrenProps<{ id: string }>) => {
            return (
              match?.params.id && (
                <ExistingSilenceEditor silenceId={match.params.id} alertManagerSourceName={selectedAlertmanager} />
              )
            );
          }}
        </Route>
      </Switch>
    </>
  );
};

function SilencesPage() {
  const pageNav = useSilenceNavData();

  return (
    <AlertmanagerPageWrapper navId="silences" pageNav={pageNav} accessType="instance">
      <Silences />
    </AlertmanagerPageWrapper>
  );
}

export default withErrorBoundary(SilencesPage, { style: 'page' });
