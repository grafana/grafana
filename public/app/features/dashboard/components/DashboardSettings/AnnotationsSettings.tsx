import React, { useState } from 'react';
import { DashboardModel } from '../../state/DashboardModel';
import { AnnotationSettingsEdit, AnnotationSettingsList } from '../AnnotationSettings';
import { newAnnotation } from '../AnnotationSettings/AnnotationSettingsEdit';
import { DashboardSettingsHeader } from './DashboardSettingsHeader';

interface Props {
  dashboard: DashboardModel;
}

export const AnnotationsSettings: React.FC<Props> = ({ dashboard }) => {
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const onGoBack = () => {
    setEditIdx(null);
  };

  const onNew = () => {
    dashboard.annotations.list = [...dashboard.annotations.list, { ...newAnnotation }];
    setEditIdx(dashboard.annotations.list.length - 1);
  };

  const onEdit = (idx: number) => {
    setEditIdx(idx);
  };

  const isEditing = editIdx !== null;

  return (
    <>
      <DashboardSettingsHeader title="Annotations" onGoBack={onGoBack} isEditing={isEditing} />
      {!isEditing && <AnnotationSettingsList dashboard={dashboard} onNew={onNew} onEdit={onEdit} />}
      {isEditing && <AnnotationSettingsEdit dashboard={dashboard} editIdx={editIdx!} />}
    </>
  );
};
