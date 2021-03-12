import React from 'react';
import { Button, Icon, HorizontalGroup } from '@grafana/ui';

type AnnotationSettingsHeaderProps = {
  onNavClick: () => void;
  onBtnClick: () => void;
  isEditing: boolean;
  hasAnnotations: boolean;
};

export const AnnotationSettingsHeader: React.FC<AnnotationSettingsHeaderProps> = ({
  onNavClick,
  onBtnClick,
  isEditing,
  hasAnnotations,
}) => {
  return (
    <div className="dashboard-settings__header">
      <HorizontalGroup align="center" justify="space-between">
        <h3>
          <span onClick={onNavClick} className={isEditing ? 'pointer' : ''}>
            Annotations
          </span>
          {isEditing && (
            <span>
              <Icon name="angle-right" /> Edit
            </span>
          )}
        </h3>
        {!isEditing && hasAnnotations ? <Button onClick={onBtnClick}>New</Button> : null}
      </HorizontalGroup>
    </div>
  );
};
