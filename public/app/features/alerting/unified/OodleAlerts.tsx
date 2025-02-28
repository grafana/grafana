import { withErrorBoundary } from '@grafana/ui';

const OodleAlerts = () => {
  if (window.parent) {
    window.parent.location.href = '/alerts';
  }
  return null;
};

export default withErrorBoundary(OodleAlerts, { style: 'page' });
