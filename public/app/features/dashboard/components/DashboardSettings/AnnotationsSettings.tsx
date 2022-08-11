import React from 'react';

import { AnnotationQuery, getDataSourceRef } from '@grafana/data';
import { getDataSourceSrv, locationService } from '@grafana/runtime';

import { AnnotationSettingsEdit, AnnotationSettingsList, newAnnotationName } from '../AnnotationSettings';

import { DashboardSettingsHeader } from './DashboardSettingsHeader';
import { SettingsPageProps } from './types';

export function AnnotationsSettings({ dashboard, editIndex }: SettingsPageProps) {
  const onGoBack = () => {
    locationService.partial({ editIndex: null });
  };

  const onNew = () => {
    const newAnnotation: AnnotationQuery = {
      name: newAnnotationName,
      enable: true,
      datasource: getDataSourceRef(getDataSourceSrv().getInstanceSettings(null)!),
      iconColor: 'red',
    };

    dashboard.annotations.list = [...dashboard.annotations.list, { ...newAnnotation }];
    locationService.partial({ editIndex: dashboard.annotations.list.length - 1 });
  };

  const onEdit = (idx: number) => {
    locationService.partial({ editIndex: idx });
  };

  const isEditing = editIndex != null && editIndex < dashboard.annotations.list.length;

  return (
    <>
      {!isEditing && <AnnotationSettingsList dashboard={dashboard} onNew={onNew} onEdit={onEdit} />}
      {isEditing && <AnnotationSettingsEdit dashboard={dashboard} editIdx={editIndex!} />}
    </>
  );
}
