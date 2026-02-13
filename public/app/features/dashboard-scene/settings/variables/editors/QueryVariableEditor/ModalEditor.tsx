import { css } from '@emotion/css';
import { useRef, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { QueryVariable } from '@grafana/scenes';
import { Alert, Button, Modal, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { dashboardEditActions } from 'app/features/dashboard-scene/edit-pane/shared';
import {
  QueryVariableStaticOptions,
  StaticOptionsOrderType,
  StaticOptionsType,
} from 'app/features/variables/query/QueryVariableStaticOptions';

import { VariableValuesPreview } from '../../components/VariableValuesPreview';

import { Editor } from './QueryVariableEditor';

type ModalEditorProps = {
  variable: QueryVariable;
  onClose: () => void;
};

export function ModalEditor(props: ModalEditorProps) {
  const styles = useStyles2(getStyles);
  const [activeTab, setActiveTab] = useState<'query' | 'staticOptions' | 'preview'>('query');

  const {
    draftVariable,
    options,
    staticOptions,
    staticOptionsOrder,
    isLoading,
    queryError,
    onStaticOptionsChange,
    onStaticOptionsOrderChange,
    previewValues,
    onCloseModal,
    onClickApply,
  } = useModalEditor(props);

  return (
    <Modal
      isOpen
      title={t('dashboard.edit-pane.variable.query-options.modal-title', 'Query Variable: {{name}}', {
        name: draftVariable.state.name,
      })}
      onDismiss={onCloseModal}
      closeOnBackdropClick={false}
      closeOnEscape={false}
    >
      <TabsBar>
        <Tab
          label={t('dashboard.edit-pane.variable.query-options.tabs.query', 'Query')}
          active={activeTab === 'query'}
          onChangeTab={() => setActiveTab('query')}
        />
        <Tab
          label={t('dashboard-scene.modal-editor.label-static-options', 'Static options ({{staticOptionsCount}})', {
            staticOptionsCount: isLoading ? '...' : staticOptions.length,
          })}
          active={activeTab === 'staticOptions'}
          onChangeTab={() => setActiveTab('staticOptions')}
        />
        <Tab
          label={t('dashboard.edit-pane.variable.query-options.tabs.preview', 'Preview ({{optionsCount}})', {
            optionsCount: isLoading ? '...' : options.length + staticOptions.length,
          })}
          active={activeTab === 'preview'}
          onChangeTab={() => {
            previewValues();
            setActiveTab('preview');
          }}
        />
      </TabsBar>
      {activeTab === 'query' && (
        <div className={styles.wrapper}>
          {queryError && <Alert title={queryError.message} severity="error" />}
          <Editor variable={draftVariable} />
        </div>
      )}
      {activeTab === 'staticOptions' && (
        <div className={styles.wrapper}>
          <QueryVariableStaticOptions
            options={options}
            staticOptions={staticOptions}
            staticOptionsOrder={staticOptionsOrder}
            onStaticOptionsChange={onStaticOptionsChange}
            onStaticOptionsOrderChange={onStaticOptionsOrderChange}
            hideTitle
          />
        </div>
      )}
      {activeTab === 'preview' && (
        <div className={styles.wrapper}>
          <VariableValuesPreview options={options} staticOptions={staticOptions ?? []} hideTitle />
        </div>
      )}
      <Modal.ButtonRow
        leftItems={
          <Button
            variant="secondary"
            onClick={previewValues}
            data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton}
          >
            <Trans i18nKey="dashboard-scene.modal-editor.run-query">Run query</Trans>
          </Button>
        }
      >
        <Button
          variant="secondary"
          fill="outline"
          onClick={onCloseModal}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.closeButton}
        >
          <Trans i18nKey="dashboard-scene.modal-editor.discard">Discard</Trans>
        </Button>
        <Button
          variant="primary"
          onClick={onClickApply}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.applyButton}
        >
          <Trans i18nKey="dashboard-scene.modal-editor.apply">Apply</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

function useDraftVariable(variable: QueryVariable) {
  const draftVariableRef = useRef<QueryVariable>();
  if (!draftVariableRef.current) {
    draftVariableRef.current = new QueryVariable(variable.state);
  }
  // ensure optional static options are removed when undo
  const initialStateRef = useRef({ staticOptions: [], ...variable.state });
  return { draftVariable: draftVariableRef.current, initialState: initialStateRef.current };
}

function useModalEditor({ variable, onClose }: ModalEditorProps) {
  const { draftVariable, initialState } = useDraftVariable(variable);
  const { options, staticOptions = [], staticOptionsOrder } = draftVariable.useState();
  const [queryError, setQueryError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(false);

  const updateVariable = async (targetVariable: QueryVariable, stateUpdate?: Partial<QueryVariable['state']>) => {
    if (stateUpdate) {
      targetVariable.setState(stateUpdate);
    }
    setIsLoading(true);
    try {
      await lastValueFrom(targetVariable.validateAndUpdate());
      setQueryError(undefined);
      return true;
    } catch (error) {
      setQueryError(error instanceof Error ? error : new Error(String(error)));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const onClickApply = async () => {
    dashboardEditActions.edit({
      source: variable,
      description: t(
        'dashboard-scene.use-modal-editor.on-click-apply.description.change-variable-query',
        'Change variable query'
      ),
      perform: async () => {
        const ok = await updateVariable(variable, draftVariable.state);
        if (ok) {
          onClose();
        }
      },
      undo: async () => {
        variable.setState(initialState);
        await lastValueFrom(variable.validateAndUpdate!());
      },
    });
  };

  const onStaticOptionsChange = (staticOptions: StaticOptionsType) => {
    updateVariable(draftVariable, { staticOptions });
  };
  const onStaticOptionsOrderChange = (staticOptionsOrder: StaticOptionsOrderType) => {
    updateVariable(draftVariable, { staticOptionsOrder });
  };

  return {
    draftVariable,
    options,
    staticOptions,
    staticOptionsOrder,
    isLoading,
    queryError,
    onStaticOptionsChange,
    onStaticOptionsOrderChange,
    onCloseModal: onClose,
    previewValues: () => {
      updateVariable(draftVariable);
    },
    onClickApply,
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      marginTop: theme.spacing(3),
      minHeight: '240px',
    }),
  };
}
