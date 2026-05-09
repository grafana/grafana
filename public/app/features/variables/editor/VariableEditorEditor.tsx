import { css, keyframes } from '@emotion/css';
import { type FormEvent, memo, useEffect, useState } from 'react';
import { connect, type ConnectedProps } from 'react-redux';
import { bindActionCreators } from 'redux';

import {
  type GrafanaTheme2,
  LoadingState,
  type SelectableValue,
  type VariableHide,
  type VariableType,
  type VariableWithOptions,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Stack, Icon, useStyles2 } from '@grafana/ui';
import { type StoreState, type ThunkDispatch } from 'app/types/store';

import { VariableHideSelect } from '../../dashboard-scene/settings/variables/components/VariableHideSelect';
import { VariableLegend } from '../../dashboard-scene/settings/variables/components/VariableLegend';
import { VariableTextAreaField } from '../../dashboard-scene/settings/variables/components/VariableTextAreaField';
import { VariableTextField } from '../../dashboard-scene/settings/variables/components/VariableTextField';
import { VariableValuesPreview } from '../../dashboard-scene/settings/variables/components/VariableValuesPreview';
import { variableAdapters } from '../adapters';
import { hasOptions } from '../guard';
import { updateOptions } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getVariable, getVariablesState } from '../state/selectors';
import { changeVariableProp, changeVariableType, removeVariable } from '../state/sharedReducer';
import { type KeyedVariableIdentifier } from '../state/types';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { VariableTypeSelect } from './VariableTypeSelect';
import { changeVariableName, variableEditorMount, variableEditorUnMount } from './actions';
import { type OnPropChangeArguments, VariableNameConstraints } from './types';

// Adapter to make legacy VariableWithOptions compatible with VariableValuesPreview
function LegacyVariableValuesPreview({ variable }: { variable: VariableWithOptions }) {
  const options = variable.options.map((opt) => ({
    label: String(opt.text),
    value: Array.isArray(opt.value) ? opt.value.join(', ') : opt.value,
    properties: opt.properties,
  }));
  return <VariableValuesPreview options={options} staticOptions={[]} />;
}

const mapStateToProps = (state: StoreState, ownProps: OwnProps) => ({
  editor: getVariablesState(ownProps.identifier.rootStateKey, state).editor,
  variable: getVariable(ownProps.identifier, state),
});

const mapDispatchToProps = (dispatch: ThunkDispatch) => {
  return {
    ...bindActionCreators({ variableEditorMount, variableEditorUnMount, changeVariableName, updateOptions }, dispatch),
    changeVariableProp: (identifier: KeyedVariableIdentifier, propName: string, propValue: unknown) =>
      dispatch(
        toKeyedAction(
          identifier.rootStateKey,
          changeVariableProp(toVariablePayload(identifier, { propName, propValue }))
        )
      ),
    changeVariableType: (identifier: KeyedVariableIdentifier, newType: VariableType) =>
      dispatch(toKeyedAction(identifier.rootStateKey, changeVariableType(toVariablePayload(identifier, { newType })))),
    removeVariable: (identifier: KeyedVariableIdentifier) => {
      dispatch(
        toKeyedAction(identifier.rootStateKey, removeVariable(toVariablePayload(identifier, { reIndex: true })))
      );
    },
  };
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export interface OwnProps {
  identifier: KeyedVariableIdentifier;
}

type Props = OwnProps & ConnectedProps<typeof connector>;

export const VariableEditorEditorUnConnected = memo(function VariableEditorEditorUnConnected({
  identifier,
  editor,
  variable,
  variableEditorMount,
  variableEditorUnMount,
  changeVariableName,
  changeVariableProp,
  changeVariableType,
  removeVariable,
  updateOptions,
}: Props) {
  const styles = useStyles2(getStyles);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    variableEditorMount(identifier);
    return () => {
      variableEditorUnMount(identifier);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onNameChange(event: FormEvent<HTMLInputElement>) {
    event.preventDefault();
    changeVariableName(identifier, event.currentTarget.value);
  }

  function onTypeChange(option: SelectableValue<VariableType>) {
    if (!option.value) {
      return;
    }
    changeVariableType(identifier, option.value);
  }

  function onLabelChange(event: FormEvent<HTMLInputElement>) {
    event.preventDefault();
    changeVariableProp(identifier, 'label', event.currentTarget.value);
  }

  function onDescriptionChange(event: FormEvent<HTMLTextAreaElement>) {
    changeVariableProp(identifier, 'description', event.currentTarget.value);
  }

  function onHideChange(option: VariableHide) {
    changeVariableProp(identifier, 'hide', option);
  }

  function onPropChanged({ propName, propValue, updateOptions: shouldUpdateOptions = false }: OnPropChangeArguments) {
    changeVariableProp(identifier, propName, propValue);

    if (shouldUpdateOptions) {
      updateOptions(toKeyedVariableIdentifier(variable));
    }
  }

  async function onHandleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor.isValid) {
      return;
    }

    updateOptions(toKeyedVariableIdentifier(variable));
  }

  function onDelete() {
    removeVariable(identifier);
    setShowDeleteModal(false);
    locationService.partial({ editIndex: null });
  }

  function onApply() {
    locationService.partial({ editIndex: null });
  }

  const EditorToRender = variableAdapters.get(variable.type).editor;
  if (!EditorToRender) {
    return null;
  }

  const loading = variable.state === LoadingState.Loading;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <>
      <form
        aria-label={t(
          'variables.variable-editor-editor-un-connected.aria-label-variable-editor-form',
          'Variable editor Form'
        )}
        onSubmit={onHandleSubmit}
      >
        <VariableTypeSelect onChange={onTypeChange} type={variable.type} />

        <VariableLegend>
          <Trans i18nKey="variables.variable-editor-editor-un-connected.general">General</Trans>
        </VariableLegend>
        <VariableTextField
          value={editor.name}
          onChange={onNameChange}
          name={t('variables.variable-editor-editor-un-connected.name-name', 'Name')}
          placeholder={t('variables.variable-editor-editor-un-connected.placeholder-variable-name', 'Variable name')}
          description={t(
            'variables.variable-editor-editor-un-connected.description-template-variable-characters',
            'The name of the template variable. (Max. 50 characters)'
          )}
          invalid={!!editor.errors.name}
          error={editor.errors.name}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2}
          maxLength={VariableNameConstraints.MaxSize}
          required
        />

        <VariableTextField
          name={t('variables.variable-editor-editor-un-connected.name-label', 'Label')}
          description={t(
            'variables.variable-editor-editor-un-connected.description-optional-display-name',
            'Optional display name'
          )}
          value={variable.label ?? ''}
          placeholder={t('variables.variable-editor-editor-un-connected.placeholder-label-name', 'Label name')}
          onChange={onLabelChange}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2}
        />
        <VariableTextAreaField
          name={t('variables.variable-editor-un-connected.name-description', 'Description')}
          value={variable.description ?? ''}
          placeholder={t(
            'variables.variable-editor-editor-un-connected.placeholder-descriptive-text',
            'Descriptive text'
          )}
          onChange={onDescriptionChange}
          width={52}
        />
        <VariableHideSelect onChange={onHideChange} hide={variable.hide} type={variable.type} />

        {EditorToRender && <EditorToRender variable={variable} onPropChange={onPropChanged} />}

        {hasOptions(variable) ? <LegacyVariableValuesPreview variable={variable} /> : null}

        <div style={{ marginTop: '16px' }}>
          <Stack gap={2} height="inherit">
            <Button variant="destructive" fill="outline" onClick={() => setShowDeleteModal(true)}>
              <Trans i18nKey="variables.variable-editor-editor-un-connected.delete">Delete</Trans>
            </Button>
            <Button
              type="submit"
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton}
              disabled={loading}
              variant="secondary"
            >
              <Trans i18nKey="variables.variable-editor-editor-un-connected.run-query">Run query</Trans>
              {loading && (
                <Icon
                  className={styles.spin}
                  name={prefersReducedMotion ? 'hourglass' : 'sync'}
                  size="sm"
                  style={{ marginLeft: '2px' }}
                />
              )}
            </Button>
            <Button
              variant="primary"
              onClick={onApply}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton}
            >
              <Trans i18nKey="variables.variable-editor-editor-un-connected.apply">Apply</Trans>
            </Button>
          </Stack>
        </div>
      </form>
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        varName={editor.name}
        onConfirm={onDelete}
        onDismiss={() => setShowDeleteModal(false)}
      />
    </>
  );
});

export const VariableEditorEditor = connector(VariableEditorEditorUnConnected);

const spin = keyframes({
  '0%': {
    transform: 'rotate(0deg) scaleX(-1)', // scaleX flips the `sync` icon so arrows point the correct way
  },
  '100%': {
    transform: 'rotate(359deg) scaleX(-1)',
  },
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    spin: css({
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${spin} 3s linear infinite`,
      },
    }),
  };
};
