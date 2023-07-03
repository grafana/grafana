import React from 'react';

import { Switch } from '@grafana/ui';

type FeatureToggle = {
  name: string;
  enabled: boolean;
  readonly: boolean;
}

interface Props {
  featureToggles: FeatureToggle[];
  onToggleChange: (featureToggle: FeatureToggle, enabled: boolean) => void;
}

export function AdminFeatureTogglesTable({ featureToggles, onToggleChange }: Props) {
  const handleToggleChange = (featureToggle: FeatureToggle) => {
      onToggleChange(featureToggle, !featureToggle.enabled);
  };


  return (
    <table className="filter-table form-inline filter-table--hover">
      <thead>
        <tr>
          <th>Name</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {featureToggles.map((featureToggle) => (
          <tr key={`${featureToggle.name}`}>
            <td>
              <div>{featureToggle.name}</div>
            </td>
            <td style={{lineHeight: 'normal'}}>
            <div><Switch value={featureToggle.enabled} disabled={featureToggle.readonly} onChange={() => handleToggleChange(featureToggle)} />
            </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
