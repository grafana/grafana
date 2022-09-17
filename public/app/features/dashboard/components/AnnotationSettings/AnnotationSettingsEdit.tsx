import React, { useState } from 'react';
import { useAsync } from 'react-use';

import { AnnotationQuery, DataSourceInstanceSettings, getDataSourceRef, TagColor, arrayUtils } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourcePicker, getDataSourceSrv, locationService } from '@grafana/runtime';
import {
  Button,
  Checkbox,
  Field,
  FieldSet,
  HorizontalGroup,
  IconButton,
  Input,
  Stack,
  VerticalGroup,
} from '@grafana/ui';
import { ColorValueEditor } from 'app/core/components/OptionsUI/color';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { getAnnotationTags } from 'app/features/annotations/api';
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

  const onTagColorTagChange = (tags: string[], editIdx: number) => {
    const newTagColors = annotation.tagColors!.map((tagColor: TagColor, idx: number) => {
      if (idx === editIdx) {
        tagColor = { ...tagColor, tags: tags };
      }
      return tagColor;
    });
    onUpdate({
      ...annotation,
      tagColors: newTagColors,
    });
  };

  const onTagColorColorChange = (color: string, editIdx: number) => {
    const newTagColors = annotation.tagColors!.map((tagColor: TagColor, idx: number) => {
      if (idx === editIdx) {
        tagColor = { ...tagColor, color: color };
      }
      return tagColor;
    });
    onUpdate({
      ...annotation,
      tagColors: newTagColors,
    });
  };

  const onAddTagColorClick = (tagColors: TagColor[]) => {
    tagColors.push({ tags: [], color: 'green' });
    onUpdate({
      ...annotation,
      tagColors: tagColors,
    });
  };

  const onRemoveTagColor = (idx: number) => {
    annotation.tagColors!.splice(idx, 1);
    onUpdate({
      ...annotation,
    });
  };

  const onMoveTagColor = (idx: number, direction: number) => {
    const reorderedTagColors = arrayUtils.moveItemImmutably(annotation.tagColors!, idx, idx + direction);
    onUpdate({
      ...annotation,
      tagColors: reorderedTagColors,
    });
  };

  const isNewAnnotation = annotation.name === newAnnotationName;

  let tagColors = annotation.tagColors ?? [];
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
        <Field label="Tag Colors" description="Color to use for the annotation event markers for given tags">
          <VerticalGroup>
            <table className="filter-table form-inline width-20">
              <thead>
                <tr>
                  <th>Color</th>
                  <th>Tag list</th>
                  <th colSpan={3}></th>
                </tr>
              </thead>
              <tbody>
                {tagColors.map((tagColor: TagColor, idx: number) => (
                  <tr key={idx}>
                    <td>
                      <ColorValueEditor
                        value={tagColor.color}
                        onChange={(color: string) => onTagColorColorChange(color, idx)}
                      />
                    </td>
                    <td>
                      <TagFilter
                        inputId={`tag-filter-${idx}`}
                        allowCustomValue
                        onChange={(tag: string[]) => onTagColorTagChange(tag, idx)}
                        tagOptions={getAnnotationTags}
                        tags={tagColor.tags}
                      />
                    </td>
                    <td style={{ width: '1%' }}>
                      {idx !== 0 && (
                        <IconButton name="arrow-up" aria-label="arrow-up" onClick={() => onMoveTagColor(idx, -1)} />
                      )}
                    </td>
                    <td style={{ width: '1%' }}>
                      {tagColors.length > 1 && idx !== tagColors.length - 1 ? (
                        <IconButton name="arrow-down" aria-label="arrow-down" onClick={() => onMoveTagColor(idx, 1)} />
                      ) : null}
                    </td>
                    <td style={{ width: '1%' }}>
                      <IconButton
                        key="delete"
                        name="trash-alt"
                        tooltip="Delete this tag color"
                        onClick={() => onRemoveTagColor(idx)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              size="sm"
              icon="plus"
              variant="secondary"
              className={'styles.addButton'}
              onClick={() => onAddTagColorClick(tagColors)}
            >
              Add tag color
            </Button>
          </VerticalGroup>
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
