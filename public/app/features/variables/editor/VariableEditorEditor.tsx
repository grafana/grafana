import { css, keyframes } from '@emotion/css';
import { FormEvent, PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { bindActionCreators } from 'redux';

import { GrafanaTheme2, LoadingState, SelectableValue, VariableHide, VariableType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Stack, Icon, Themeable2, withTheme2 } from '@grafana/ui';
import { StoreState, ThunkDispatch } from 'app/types/store';

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
import { KeyedVariableIdentifier } from '../state/types';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { VariableTypeSelect } from './VariableTypeSelect';
import { changeVariableName, variableEditorMount, variableEditorUnMount } from './actions';
import { OnPropChangeArguments, VariableNameConstraints } from './types';

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

export interface OwnProps extends Themeable2 {
  identifier: KeyedVariableIdentifier;
}

type Props = OwnProps & ConnectedProps<typeof connector>;

interface State {
  showDeleteModal: boolean;
}

export class VariableEditorEditorUnConnected extends PureComponent<Props, State> {
  state: State = {
    showDeleteModal: false,
  };

  componentDidMount(): void {
    this.props.variableEditorMount(this.props.identifier);
  }

  componentWillUnmount(): void {
    this.props.variableEditorUnMount(this.props.identifier);
  }

  onNameChange = (event: FormEvent<HTMLInputElement>) => {
    event.preventDefault();
    this.props.changeVariableName(this.props.identifier, event.currentTarget.value);
  };

  onTypeChange = (option: SelectableValue<VariableType>) => {
    if (!option.value) {
      return;
    }
    this.props.changeVariableType(this.props.identifier, option.value);
  };

  onLabelChange = (event: FormEvent<HTMLInputElement>) => {
    event.preventDefault();
    this.props.changeVariableProp(this.props.identifier, 'label', event.currentTarget.value);
  };

  onDescriptionChange = (event: FormEvent<HTMLTextAreaElement>) => {
    this.props.changeVariableProp(this.props.identifier, 'description', event.currentTarget.value);
  };

  onHideChange = (option: VariableHide) => {
    this.props.changeVariableProp(this.props.identifier, 'hide', option);
  };

  onPropChanged = ({ propName, propValue, updateOptions = false }: OnPropChangeArguments) => {
    this.props.changeVariableProp(this.props.identifier, propName, propValue);

    if (updateOptions) {
      this.props.updateOptions(toKeyedVariableIdentifier(this.props.variable));
    }
  };

  onHandleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!this.props.editor.isValid) {
      return;
    }

    this.props.updateOptions(toKeyedVariableIdentifier(this.props.variable));
  };

  onModalOpen = () => {
    this.setState({ showDeleteModal: true });
  };

  onModalClose = () => {
    this.setState({ showDeleteModal: false });
  };

  onDelete = () => {
    this.props.removeVariable(this.props.identifier);
    this.onModalClose();
    locationService.partial({ editIndex: null });
  };

  onApply = () => {
    locationService.partial({ editIndex: null });
  };

  getVariableOptions = () => {
    const { variable } = this.props;
    if (!hasOptions(variable)) {
      return [];
    }
    return variable.options.map((option) => ({ label: String(option.text), value: String(option.value) }));
  };

  render() {
    const { theme, variable } = this.props;
    const EditorToRender = variableAdapters.get(this.props.variable.type).editor;
    if (!EditorToRender) {
      return null;
    }
    const loading = variable.state === LoadingState.Loading;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const styles = getStyles(theme);

    return (
      <>
        <form
          aria-label={t(
            'variables.variable-editor-editor-un-connected.aria-label-variable-editor-form',
            'Variable editor Form'
          )}
          onSubmit={this.onHandleSubmit}
        >
          <VariableTypeSelect onChange={this.onTypeChange} type={this.props.variable.type} />

          <VariableLegend>
            <Trans i18nKey="variables.variable-editor-editor-un-connected.general">General</Trans>
          </VariableLegend>
          <VariableTextField
            value={this.props.editor.name}
            onChange={this.onNameChange}
            name={t('variables.variable-editor-editor-un-connected.name-name', 'Name')}
            placeholder={t('variables.variable-editor-editor-un-connected.placeholder-variable-name', 'Variable name')}
            description={t(
              'variables.variable-editor-editor-un-connected.description-template-variable-characters',
              'The name of the template variable. (Max. 50 characters)'
            )}
            invalid={!!this.props.editor.errors.name}
            error={this.props.editor.errors.name}
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
            value={this.props.variable.label ?? ''}
            placeholder={t('variables.variable-editor-editor-un-connected.placeholder-label-name', 'Label name')}
            onChange={this.onLabelChange}
            testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInputV2}
          />
          <VariableTextAreaField
            name={t('variables.variable-editor-un-connected.name-description', 'Description')}
            value={variable.description ?? ''}
            placeholder={t(
              'variables.variable-editor-editor-un-connected.placeholder-descriptive-text',
              'Descriptive text'
            )}
            onChange={this.onDescriptionChange}
            width={52}
          />
          <VariableHideSelect
            onChange={this.onHideChange}
            hide={this.props.variable.hide}
            type={this.props.variable.type}
          />

          {EditorToRender && <EditorToRender variable={this.props.variable} onPropChange={this.onPropChanged} />}

          {hasOptions(this.props.variable) ? <VariableValuesPreview options={this.getVariableOptions()} /> : null}

          <div style={{ marginTop: '16px' }}>
            <Stack gap={2} height="inherit">
              <Button variant="destructive" fill="outline" onClick={this.onModalOpen}>
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
                onClick={this.onApply}
                data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.applyButton}
              >
                <Trans i18nKey="variables.variable-editor-editor-un-connected.apply">Apply</Trans>
              </Button>
            </Stack>
          </div>
        </form>
        <ConfirmDeleteModal
          isOpen={this.state.showDeleteModal}
          varName={this.props.editor.name}
          onConfirm={this.onDelete}
          onDismiss={this.onModalClose}
        />
      </>
    );
  }
}

export const VariableEditorEditor = withTheme2(connector(VariableEditorEditorUnConnected));

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
