import React, { useState } from 'react';
import { useAsync } from 'react-use';

import { AnnotationQuery, DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourcePicker, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, Checkbox, Field, FieldSet, HorizontalGroup, Input, Stack } from '@grafana/ui';
import { ColorValueEditor } from 'app/core/components/OptionsUI/color';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';

import { DashboardModel } from '../../state/DashboardModel';

import { AngularEditorLoader } from './AngularEditorLoader';

type Props = {
  editIdx: number;
  dashboard: DashboardModel;
};

export const newAnnotationName = 'New annotation';

export const AnnotationSettingsEdit = ({ editIdx, dashboard }: Props) => {
  const [annotation, setAnnotation] = useState(dashboard.annotations.list[editIdx]);

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
      datasource: getDataSourceRef(ds),
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

  const onApply = goBackToList;

  const onPreview = () => {
    locationService.partial({ editview: null, editIndex: null });
  };

  const onDelete = () => {
    const annotations = dashboard.annotations.list;
    dashboard.annotations.list = [...annotations.slice(0, editIdx), ...annotations.slice(editIdx + 1)];
    goBackToList();
  };

  const isNewAnnotation = annotation.name === newAnnotationName;

  return (
    <div>
      <FieldSet>
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
        <Field label="Data source" htmlFor="data-source-picker">
          <DataSourcePicker
            width={50}
            annotations
            variables
            current={annotation.datasource}
            onChange={onDataSourceChange}
          />
        </Field>
        <Field label="Enabled" description="When enabled the annotation query is issued every dashboard refresh">
          <Checkbox name="enable" id="enable" value={annotation.enable} onChange={onChange} />
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
        <h3 className="page-heading">Query</h3>
        {ds?.annotations && (
          <StandardAnnotationQueryEditor datasource={ds} annotation={annotation} onChange={onUpdate} />
        )}
        {ds && !ds.annotations && <AngularEditorLoader datasource={ds} annotation={annotation} onChange={onUpdate} />}
      </FieldSet>
      <Stack>
        <Button variant="destructive" onClick={onDelete}>
          Delete
        </Button>
        <Button variant="secondary" onClick={onPreview}>
          Preview in dashboard
        </Button>
        <Button variant="primary" onClick={onApply}>
          Apply
        </Button>
      </Stack>
    </div>
  );
};

AnnotationSettingsEdit.displayName = 'AnnotationSettingsEdit';

function goBackToList() {
  locationService.partial({ editIndex: null });
}
