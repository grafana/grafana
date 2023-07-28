import React from 'react';

import { Switch } from '@grafana/ui';

type FeatureToggle = {
  name: string;
  enabled: boolean;
  description: string;
};

interface Props {
  featureToggles: FeatureToggle[];
}

export function AdminFeatureTogglesTable({ featureToggles }: Props) {
  return (
    <table className="filter-table form-inline filter-table--hover">
      <thead>
        <tr>
          <th>Name</th>
          <th>Description</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {featureToggles.map((featureToggle) => (
          <tr key={`${featureToggle.name}`}>
            <td>
              <div>{featureToggle.name}</div>
            </td>
            <td
              style={{
                overflowWrap: 'break-word',
                wordWrap: 'break-word',
                whiteSpace: 'normal',
              }}
            >
              <div>{featureToggle.description}</div>
            </td>
            <td style={{ lineHeight: 'normal' }}>
              <div>
                <Switch value={featureToggle.enabled} disabled={true} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
