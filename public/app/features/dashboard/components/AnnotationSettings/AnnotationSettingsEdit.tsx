import React, { useState } from 'react';
import { Field, Input } from '@grafana/ui';
import { DashboardModel } from '../../state/DashboardModel';
import { AnnotationQuery, DataSourceInstanceSettings } from '@grafana/data';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';

export const newAnnotation: AnnotationQuery = {
  name: 'New annotation',
  enable: true,
  datasource: null,
  iconColor: 'red',
};

type Props = {
  editIdx: number | null;
  dashboard: DashboardModel;
};

export const AnnotationSettingsEdit: React.FC<Props> = ({ editIdx, dashboard }) => {
  const [annotation, setAnnotation] = useState(editIdx !== null ? dashboard.annotations.list[editIdx] : newAnnotation);

  const onUpdate = (annotation: AnnotationQuery) => {
    const list = [...dashboard.annotations.list];
    list.splice(editIdx!, 1, annotation);
    setAnnotation(annotation);
    dashboard.annotations = dashboard.annotations;
  };

  const onNameChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    onUpdate({
      ...annotation,
      name: ev.currentTarget.value,
    });
  };

  const onDataSourceChange = (ds: DataSourceInstanceSettings) => {
    onUpdate({
      ...annotation,
      datasource: ds.name,
    });
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <Field label="Name">
        <Input name="name" aria-label="name" value={annotation.name} onChange={onNameChange} />
      </Field>
      <Field label="Data source">
        <DataSourcePicker annotations current={annotation.datasource} onChange={onDataSourceChange} />
      </Field>
    </div>
  );
};
