import React, { FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { SceneVariable } from '@grafana/scenes';
import { HorizontalGroup, Button, Icon } from '@grafana/ui';
import { ConfirmDeleteModal } from 'app/features/variables/editor/ConfirmDeleteModal';
// import { VariableHideSelect } from 'app/features/variables/editor/VariableHideSelect';
import { VariableLegend } from 'app/features/variables/editor/VariableLegend';
import { VariableTextAreaField } from 'app/features/variables/editor/VariableTextAreaField';
import { VariableTextField } from 'app/features/variables/editor/VariableTextField';
import { VariableTypeSelect } from 'app/features/variables/editor/VariableTypeSelect';
import { VariableValuesPreview } from 'app/features/variables/editor/VariableValuesPreview';
import { VariableNameConstraints } from 'app/features/variables/editor/types';
import { hasOptions } from 'app/features/variables/guard';

interface VariableEditorFormProps {
  variable: SceneVariable;
}

function onHandleSubmit(event: FormEvent<HTMLFormElement>) {
  console.log('onHandleSubmit');
}

function onNameChange(event: FormEvent<HTMLInputElement>) {
  console.log('onNameChange');
}

function onTypeChange(type: SceneVariable) {
  console.log('onTypeChange');
}

function onLabelChange(event: FormEvent<HTMLInputElement>) {
  console.log('onLabelChange');
}

function onDescriptionChange(event: FormEvent<HTMLTextAreaElement>) {
  console.log('onDescriptionChange');
}

// function onHideChange(hide: boolean) {
//   console.log('onHideChange');
// }

function onApply() {
  locationService.partial({ editIndex: null });
}

function onModalOpen() {
  console.log('onModalOpen');
}

// function onPropChanged(prop: string, value: any) {
//   console.log('onPropChanged');
// }

// function EditorToRender(variable: SceneVariable) {
//   console.log('editorToRender');
//   return <div>EditorToRender</div>;
// }

export function VariableEditorForm({ variable }: VariableEditorFormProps) {
  //TODO: this are test and mocks
  const loading = false; // in the old system we were using this loading? why
  //mock propss until I figure out the whole editor situation
  const props = { editor: { name: 'name', errors: { name: 'name' } } };
  return (
    <>
      <form aria-label="Variable editor Form" onSubmit={onHandleSubmit}>
        <VariableTypeSelect onChange={onTypeChange} type={variable.type} />

        <VariableLegend>General</VariableLegend>
        <VariableTextField
          value={props.editor.name}
          onChange={onNameChange}
          name="Name"
          placeholder="Variable name"
          description="The name of the template variable. (Max. 50 characters)"
          invalid={!!props.editor.errors.name}
          error={props.editor.errors.name}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2}
          maxLength={VariableNameConstraints.MaxSize}
          required
        />

        <VariableTextField
          name="Label"
          description="Optional display name"
          value={variable.label ?? ''}
          placeholder="Label name"
          onChange={onLabelChange}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2}
        />
        <VariableTextAreaField
          name="Description"
          value={variable.description ?? ''}
          placeholder="Descriptive text"
          onChange={onDescriptionChange}
          width={52}
        />
        {/***

        <VariableHideSelect onChange={onHideChange} hide={variable.hide} type={variable.type} />

        {EditorToRender && <EditorToRender variable={variable} onPropChange={onPropChanged} />}

       */}

        {hasOptions(variable) ? <VariableValuesPreview variable={variable} /> : null}

        <div style={{ marginTop: '16px' }}>
          <HorizontalGroup spacing="md" height="inherit">
            <Button variant="destructive" fill="outline" onClick={onModalOpen}>
              Delete
            </Button>
            <Button
              type="submit"
              aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton}
              disabled={loading}
              variant="secondary"
            >
              Run query
              {loading && <Icon className="spin-clockwise" name="sync" size="sm" style={{ marginLeft: '2px' }} />}
            </Button>
            <Button
              variant="primary"
              onClick={onApply}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton}
            >
              Apply
            </Button>
          </HorizontalGroup>
        </div>
      </form>
      <ConfirmDeleteModal
        isOpen={false}
        varName={variable.name}
        onConfirm={() => console.log('needs implementation')}
        onDismiss={() => console.log('needs implementation')}
      />
    </>
  );
}
