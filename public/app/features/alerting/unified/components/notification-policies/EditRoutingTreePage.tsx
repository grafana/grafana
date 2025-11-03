import { useParams } from 'react-router-dom-v5-compat';

import { Alert } from '@grafana/ui';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { NotificationPoliciesTree } from './NotificationPoliciesTree';
import { ROOT_ROUTE_NAME } from '../../utils/k8s/constants';

const EditRoutingTree = () => {
  const { name = '' } = useParams();

  const routeName = decodeURIComponent(name);

  if (!routeName) {
    return (
      <Alert severity="error" title={'Routing tree not found'}>
        {'Sorry, this routing tree does not seem to exist.'}
      </Alert>
    );
  }

  return <NotificationPoliciesTree routeName={routeName} />;
};

function EditRoutingTreePage() {
  const { name = '' } = useParams();
  const routeName = name === ROOT_ROUTE_NAME ? "Default Policy" : decodeURIComponent(name);

  const pageNav = {
    text: routeName,
  };
  return (
    <AlertmanagerPageWrapper navId="am-routes" pageNav={pageNav} accessType="notification">
      <EditRoutingTree />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(EditRoutingTreePage);
