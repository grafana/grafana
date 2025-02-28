import { withErrorBoundary } from '@grafana/ui';

const OodleAlertsCreate = () => {
  if (window.parent) {
    window.parent.location.href = '/alerts/create';
  }
  return null;
};

export default withErrorBoundary(OodleAlertsCreate, { style: 'page' });
