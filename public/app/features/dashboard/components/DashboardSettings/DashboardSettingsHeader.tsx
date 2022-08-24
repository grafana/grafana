import React from 'react';

import { config } from '@grafana/runtime';
import { Icon, HorizontalGroup } from '@grafana/ui';

type Props = {
  title: string;
  onGoBack: () => void;
  isEditing: boolean;
};

export const DashboardSettingsHeader: React.FC<Props> = ({ onGoBack, isEditing, title }) => {
  if (config.featureToggles.topnav) {
    return null;
  }

  return (
    <div className="dashboard-settings__header">
      <HorizontalGroup align="center" justify="space-between">
        <h3>
          <span onClick={onGoBack} className={isEditing ? 'pointer' : ''}>
            {title}
          </span>
          {isEditing && (
            <span>
              <Icon name="angle-right" /> Edit
            </span>
          )}
        </h3>
      </HorizontalGroup>
    </div>
  );
};
