import { useParams } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { useRouteGroupsMatcher } from 'app/features/alerting/unified/useRouteGroupsMatcher';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useNotificationPoliciesNav } from '../../navigation/useNotificationConfigNav';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { ROOT_ROUTE_NAME } from '../../utils/k8s/constants';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { Title } from '../common/Title';

import { PoliciesTree } from './PoliciesTree';

const PoliciesTreeWrapper = () => {
  const { name = '' } = useParams();
  const { selectedAlertmanager = '' } = useAlertmanager();
  const [, canSeeAlertGroups] = useAlertmanagerAbility(AlertmanagerAction.ViewAlertGroups);
  const { getRouteGroupsMap } = useRouteGroupsMatcher();
  const { currentData: alertGroups, refetch: refetchAlertGroups } = alertmanagerApi.useGetAlertmanagerAlertGroupsQuery(
    { amSourceName: selectedAlertmanager },
    { skip: !canSeeAlertGroups || !selectedAlertmanager }
  );

  const routeName = decodeURIComponent(name);

  if (!routeName) {
    return (
      <Alert
        severity="error"
        title={t('alerting.policies-tree-wrapper.title-routing-tree-not-found', 'Routing tree not found')}
      >
        <Trans i18nKey="alerting.policies-tree-wrapper.sorry-routing-exist">
          Sorry, this routing tree does not seem to exist.
        </Trans>
      </Alert>
    );
  }

  return (
    <PoliciesTree
      routeName={routeName}
      alertGroups={alertGroups}
      refetchAlertGroups={refetchAlertGroups}
      getRouteGroupsMap={getRouteGroupsMap}
    />
  );
};

function PolicyPage() {
  const { name = '' } = useParams();
  const routeName = name === ROOT_ROUTE_NAME ? 'Default Policy' : decodeURIComponent(name);
  const { navId, pageNav } = useNotificationPoliciesNav();

  return (
    <AlertmanagerPageWrapper
      navId={navId}
      accessType="notification"
      pageNav={{
        text: routeName,
        parentItem: pageNav,
      }}
      renderTitle={(title) => <Title name={title} returnToFallback={'/alerting/routes'} />}
      subTitle={t(
        'alerting.policy-page.text-subtitle',
        'Determine how alerts are routed to contact points for alert rules configured to use this notification policy.'
      )}
    >
      <PoliciesTreeWrapper />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(PolicyPage);
