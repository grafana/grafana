import { Route, RouteChildrenProps, Switch } from 'react-router-dom';

import { withErrorBoundary } from '@grafana/ui';
import {
  defaultsFromQuery,
  getDefaultSilenceFormValues,
} from 'app/features/alerting/unified/components/silences/utils';
import { MATCHER_ALERT_RULE_UID } from 'app/features/alerting/unified/utils/constants';
import { parseQueryParamMatchers } from 'app/features/alerting/unified/utils/matchers';

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

            const potentialAlertRuleMatcher = parseQueryParamMatchers(queryParams.getAll('matcher')).find(
              (m) => m.name === MATCHER_ALERT_RULE_UID
            );

            const potentialRuleUid = potentialAlertRuleMatcher?.value;

            const formValues = getDefaultSilenceFormValues(defaultsFromQuery(queryParams));

            return (
              <SilencesEditor
                formValues={formValues}
                alertManagerSourceName={selectedAlertmanager}
                ruleUid={potentialRuleUid}
              />
            );
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
