import React, { useState } from 'react';
import { Checkbox, CollapsableSection, ColorValueEditor, Field, HorizontalGroup, Input } from '@grafana/ui';
import { DashboardModel } from '../../state/DashboardModel';
import { AnnotationQuery, DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv, DataSourcePicker } from '@grafana/runtime';
import { useAsync } from 'react-use';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';
import { AngularEditorLoader } from './AngularEditorLoader';
import { selectors } from '@grafana/e2e-selectors';

export const newAnnotation: AnnotationQuery = {
  name: 'New annotation',
  enable: true,
  datasource: null,
  iconColor: 'red',
};

type Props = {
  editIdx: number;
  dashboard: DashboardModel;
};

export const AnnotationSettingsEdit: React.FC<Props> = ({ editIdx, dashboard }) => {
  const [annotation, setAnnotation] = useState(editIdx !== null ? dashboard.annotations.list[editIdx] : newAnnotation);

  const { value: ds } = useAsync(() => {
    return getDataSourceSrv().get(annotation.datasource);
  }, [annotation.datasource]);

  const onUpdate = (annotation: AnnotationQuery) => {
    const list = [...dashboard.annotations.list];
    list.splice(editIdx, 1, annotation);
    setAnnotation(annotation);
    dashboard.annotations.list = list;
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

  const onChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    const target = ev.currentTarget;
    onUpdate({
      ...annotation,
      [target.name]: target.type === 'checkbox' ? target.checked : target.value,
    });
  };

  const onColorChange = (color: string) => {
    onUpdate({
      ...annotation,
      iconColor: color,
    });
  };

  const isNewAnnotation = annotation.name === newAnnotation.name;

  return (
    <div>
      <Field label="Name">
        <Input
          aria-label={selectors.pages.Dashboard.Settings.Annotations.Settings.name}
          name="name"
          id="name"
          autoFocus={isNewAnnotation}
          value={annotation.name}
          onChange={onNameChange}
          width={50}
        />
      </Field>
      <Field label="Data source">
        <DataSourcePicker width={50} annotations current={annotation.datasource} onChange={onDataSourceChange} />
      </Field>
      <Field
        label="Hidden"
        description="Annotation queries can be toggled on or off at the top of the dashboard. With this option checked this toggle will be hidden."
      >
        <Checkbox name="hide" id="hide" value={annotation.hide} onChange={onChange} />
      </Field>
      <Field label="Color" description="Color to use for the annotation event markers">
        <HorizontalGroup>
          <ColorValueEditor value={annotation?.iconColor} onChange={onColorChange} />
        </HorizontalGroup>
      </Field>
      <CollapsableSection isOpen={true} label="Query">
        {ds?.annotations && (
          <StandardAnnotationQueryEditor datasource={ds} annotation={annotation} onChange={onUpdate} />
        )}
        {ds && !ds.annotations && <AngularEditorLoader datasource={ds} annotation={annotation} onChange={onUpdate} />}
      </CollapsableSection>
    </div>
  );
};

AnnotationSettingsEdit.displayName = 'AnnotationSettingsEdit';
