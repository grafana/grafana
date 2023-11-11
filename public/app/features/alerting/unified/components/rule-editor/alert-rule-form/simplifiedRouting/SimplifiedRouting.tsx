import React from 'react';

import { Field, InputControl, Select } from '@grafana/ui';
import { mapSelectValueToString } from 'app/features/alerting/unified/utils/amroutes';

export function SimplifiedRouting() {
  return (
    <Field label="Contact point">
      <InputControl
        render={({ field: { onChange, ref, ...field } }) => (
          <Select
            aria-label="Contact point"
            {...field}
            onChange={(value) => onChange(mapSelectValueToString(value))}
            options={[
              { label: 'Email', value: 'email' },
              { label: 'Slack', value: 'slack' },
              { label: 'PagerDuty', value: 'pagerduty' },
              { label: 'Webhook', value: 'webhook' },
            ]}
            isClearable
            width={50}
          />
        )}
        name="receiver"
      />
    </Field>
  );
}
