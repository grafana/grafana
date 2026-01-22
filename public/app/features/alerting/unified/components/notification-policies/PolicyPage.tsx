import { useParams } from 'react-router-dom-v5-compat';

import { Alert } from '@grafana/ui';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { PoliciesTree } from './PoliciesTree';
import { ROOT_ROUTE_NAME } from '../../utils/k8s/constants';

const PoliciesTreeWrapper = () => {
  const { name = '' } = useParams();

  const routeName = decodeURIComponent(name);

  if (!routeName) {
    return (
      <Alert severity="error" title={'Routing tree not found'}>
        {'Sorry, this routing tree does not seem to exist.'}
      </Alert>
    );
  }

  return <PoliciesTree routeName={routeName} />;
};

function PolicyPage() {
  const { name = '' } = useParams();
  const routeName = name === ROOT_ROUTE_NAME ? "Default Policy" : decodeURIComponent(name);

  const pageNav = {
    text: routeName,
  };
  return (
    <AlertmanagerPageWrapper navId="am-routes" pageNav={pageNav} accessType="notification">
      <PoliciesTreeWrapper />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(PolicyPage);
