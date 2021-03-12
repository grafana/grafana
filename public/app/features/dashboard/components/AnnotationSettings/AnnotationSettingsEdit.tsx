import React, { useState } from 'react';
import { css } from 'emotion';
import { Button, Field, Input } from '@grafana/ui';
import { AnnotationSettingsMode } from '../DashboardSettings/AnnotationsSettings';
import { DashboardModel } from '../../state/DashboardModel';
import { AnnotationQuery } from '@grafana/data';

const newAnnotation: AnnotationQuery = {
  name: 'New annotation',
  enable: true,
  datasource: null,
  iconColor: 'red',
};

type Props = {
  mode: AnnotationSettingsMode;
  editIdx: number | null;
  dashboard: DashboardModel;
  onGoBack: () => void;
};

export const AnnotationSettingsEdit: React.FC<Props> = ({ mode, editIdx, dashboard, onGoBack }) => {
  const [annotation, setAnnotation] = useState(editIdx !== null ? dashboard.annotations.list[editIdx] : newAnnotation);

  const onNameChange = (ev: React.FocusEvent<HTMLInputElement>) => {
    setAnnotation({
      ...annotation,
      name: ev.currentTarget.value,
    });
  };

  const updateLink = () => {
    dashboard.annotations.list.splice(editIdx!, 1, annotation);
    dashboard.updateSubmenuVisibility();
    onGoBack();
  };

  const addLink = () => {
    dashboard.annotations.list = [...dashboard.annotations.list, annotation];
    dashboard.updateSubmenuVisibility();
    onGoBack();
  };

  return (
    <div
      className={css`
        max-width: 600px;
      `}
    >
      <Field label="Name">
        <Input name="name" aria-label="name" value={annotation.name} onChange={onNameChange} />
      </Field>

      <div className="gf-form-button-row">
        {mode === 'new' && <Button onClick={addLink}>Add</Button>}
        {mode === 'edit' && <Button onClick={updateLink}>Update</Button>}
      </div>
    </div>
  );
};
