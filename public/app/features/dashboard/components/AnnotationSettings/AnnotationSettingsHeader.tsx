import React from 'react';
import { Button, Icon, HorizontalGroup } from '@grafana/ui';
import { AnnotationSettingsMode } from '../DashboardSettings/AnnotationsSettings';

type AnnotationSettingsHeaderProps = {
  onNavClick: () => void;
  onBtnClick: () => void;
  mode: AnnotationSettingsMode;
  hasAnnotations: boolean;
};

export const AnnotationSettingsHeader: React.FC<AnnotationSettingsHeaderProps> = ({
  onNavClick,
  onBtnClick,
  mode,
  hasAnnotations,
}) => {
  const isEditing = mode !== 'list';

  return (
    <div className="dashboard-settings__header">
      <HorizontalGroup align="center" justify="space-between">
        <h3>
          <span onClick={onNavClick} className={isEditing ? 'pointer' : ''}>
            Annotations
          </span>
          {isEditing && (
            <span>
              <Icon name="angle-right" /> {mode === 'new' ? 'New' : 'Edit'}
            </span>
          )}
        </h3>
        {!isEditing && hasAnnotations ? <Button onClick={onBtnClick}>New</Button> : null}
      </HorizontalGroup>
    </div>
  );
};
