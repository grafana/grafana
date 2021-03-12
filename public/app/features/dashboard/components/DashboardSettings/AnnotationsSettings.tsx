import React, { useState } from 'react';
import { DashboardModel } from '../../state/DashboardModel';
import { AnnotationSettingsEdit, AnnotationSettingsHeader, AnnotationSettingsList } from '../AnnotationSettings';
import { newAnnotation } from '../AnnotationSettings/AnnotationSettingsEdit';
interface Props {
  dashboard: DashboardModel;
}

export const AnnotationsSettings: React.FC<Props> = ({ dashboard }) => {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const hasAnnotations = dashboard.annotations.list.length > 0;

  const onGoBack = () => {
    setEditIdx(null);
  };

  const onNew = () => {
    dashboard.annotations.list.push({
      ...newAnnotation,
    });
    setEditIdx(dashboard.annotations.list.length - 1);
  };

  const onEdit = (idx: number) => {
    setEditIdx(idx);
  };

  const isEditing = editIdx !== null;

  return (
    <>
      <AnnotationSettingsHeader
        onNavClick={onGoBack}
        onBtnClick={onNew}
        isEditing={isEditing}
        hasAnnotations={hasAnnotations}
      />
      {!isEditing && <AnnotationSettingsList dashboard={dashboard} onNew={onNew} onEdit={onEdit} />}
      {isEditing && <AnnotationSettingsEdit dashboard={dashboard} editIdx={editIdx} />}
    </>
  );
};
