import React from 'react';

import { AnnotationQuery, getDataSourceRef, NavModelItem } from '@grafana/data';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { DashboardModel } from '../../state';
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
    <Page navModel={sectionNav} pageNav={getSubPageNav(dashboard, editIndex)}>
      {!isEditing && <AnnotationSettingsList dashboard={dashboard} onNew={onNew} onEdit={onEdit} />}
      {isEditing && <AnnotationSettingsEdit dashboard={dashboard} editIdx={editIndex!} />}
    </Page>
  );
}

function getSubPageNav(dashboard: DashboardModel, editIndex: number | undefined): NavModelItem | undefined {
  if (editIndex == null) {
    return undefined;
  }

  const editItem = dashboard.annotations.list[editIndex];
  if (editItem) {
    return {
      text: editItem.name,
    };
  }

  return undefined;
}
