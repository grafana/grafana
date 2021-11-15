import React, { FC } from 'react';

import { Alert } from '@grafana/ui';
import { useLocalStorage } from 'react-use';

export const LOCAL_STORAGE_KEY = 'LegacyAlerting.UnifiedAlertingPromotion';

const UnifiedAlertingPromotion: FC<{}> = () => {
  const [showUnifiedAlertingPromotion, setShowUnifiedAlertingPromotion] = useLocalStorage<boolean>(
    LOCAL_STORAGE_KEY,
    true
  );

  if (!showUnifiedAlertingPromotion) {
    return null;
  }

  return (
    <Alert
      severity="info"
      title="Try out the Grafana 8 alerting!"
      onRemove={() => setShowUnifiedAlertingPromotion(false)}
    >
      <p>
        You are using the legacy Grafana alerts feature.
        <br />
        While this feature will not be deprecated any time soon and continue to work as intend, we invite you to give
        the new Grafana 8 alerting a try.
      </p>
      <p>
        See{' '}
        <a href="https://grafana.com/docs/grafana/latest/alerting/unified-alerting/difference-old-new/">
          What’s New with Grafana 8 alerting
        </a>{' '}
        to learn more about what&lsquo;s new in Grafana 8 alerting or learn{' '}
        <a href="https://grafana.com/docs/grafana/latest/alerting/unified-alerting/opt-in/">
          how to enable the new Grafana 8 alerting feature
        </a>
        .
      </p>
    </Alert>
  );
};

export { UnifiedAlertingPromotion };
