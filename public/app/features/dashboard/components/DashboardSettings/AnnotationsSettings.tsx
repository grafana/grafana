import React, { useState } from 'react';
import { DashboardModel } from '../../state/DashboardModel';
import { AnnotationSettingsEdit, AnnotationSettingsHeader, AnnotationSettingsList } from '../AnnotationSettings';
interface Props {
  dashboard: DashboardModel;
}

export type AnnotationSettingsMode = 'list' | 'new' | 'edit';

export const AnnotationsSettings: React.FC<Props> = ({ dashboard }) => {
  const [mode, setMode] = useState<AnnotationSettingsMode>('list');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const hasAnnotations = dashboard.annotations.list.length > 0;

  const onGoBack = () => {
    setMode('list');
  };

  const onNew = () => {
    setEditIdx(null);
    setMode('new');
  };

  const onEdit = (idx: number) => {
    setEditIdx(idx);
    setMode('edit');
  };

  return (
    <>
      <AnnotationSettingsHeader onNavClick={onGoBack} onBtnClick={onNew} mode={mode} hasAnnotations={hasAnnotations} />
      {mode === 'list' ? (
        <AnnotationSettingsList dashboard={dashboard} onNew={onNew} onEdit={onEdit} />
      ) : (
        <AnnotationSettingsEdit dashboard={dashboard} mode={mode} editIdx={editIdx} onGoBack={onGoBack} />
      )}
    </>
  );
};
