import React from 'react';

import { config } from '@grafana/runtime';
import { TextLink } from '@grafana/ui';

import { CollapsibleAlert } from './CollapsibleAlert';

const LOCAL_STORAGE_KEY = 'grafana.unifiedalerting.upgrade.previewNotice';

export const UAPreviewNotice = () => {
  if (config.unifiedAlertingEnabled || !config.featureToggles.alertingPreviewUpgrade) {
    return null;
  }

  return (
    <CollapsibleAlert
      localStoreKey={LOCAL_STORAGE_KEY}
      alertTitle={'This is a preview of the upgraded Grafana Alerting'}
      collapseText={'Grafana Alerting Preview'}
      collapseTooltip={'Show preview warning'}
      severity={'warning'}
    >
      <p>
        No rules are being evaluated and legacy alerting is still running.
        <br />
        Please contact your administrator to upgrade permanently.
      </p>
      <TextLink external href={'https://grafana.com/docs/grafana/latest/alerting/set-up/migrating-alerts/'}>
        Read about upgrading
      </TextLink>
    </CollapsibleAlert>
  );
};
