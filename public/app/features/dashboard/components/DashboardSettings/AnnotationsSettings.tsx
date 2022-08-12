import React from 'react';

import { AnnotationQuery, getDataSourceRef } from '@grafana/data';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/PageNew/Page';

import { AnnotationSettingsEdit, AnnotationSettingsList, newAnnotationName } from '../AnnotationSettings';

import { SettingsPageProps } from './types';

export function AnnotationsSettings({ dashboard, editIndex, sectionNav }: SettingsPageProps) {
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
    <Page navModel={sectionNav}>
      {!isEditing && <AnnotationSettingsList dashboard={dashboard} onNew={onNew} onEdit={onEdit} />}
      {isEditing && <AnnotationSettingsEdit dashboard={dashboard} editIdx={editIndex!} />}
    </Page>
  );
}
