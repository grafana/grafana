import { useParams } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { ROOT_ROUTE_NAME } from '../../utils/k8s/constants';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { Title } from '../common/Title';

import { PoliciesTree } from './PoliciesTree';

const PoliciesTreeWrapper = () => {
  const { name = '' } = useParams();

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

  return <PoliciesTree routeName={routeName} />;
};

function PolicyPage() {
  const { name = '' } = useParams();
  const routeName = name === ROOT_ROUTE_NAME ? 'Default Policy' : decodeURIComponent(name);

  return (
    <AlertmanagerPageWrapper
      navId="am-routes"
      accessType="notification"
      pageNav={{
        text: routeName,
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
