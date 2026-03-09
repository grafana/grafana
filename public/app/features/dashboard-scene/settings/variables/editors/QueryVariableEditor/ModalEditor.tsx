import { css } from '@emotion/css';
import { useRef, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { QueryVariable } from '@grafana/scenes';
import { Alert, Button, Drawer, Spinner, Stack, Tab, TabsBar, useSplitter, useStyles2 } from '@grafana/ui';
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

// TODO: rename
export function ModalEditor(props: ModalEditorProps) {
  const styles = useStyles2(getStyles);
  const [activeTab, setActiveTab] = useState<'query' | 'staticOptions'>('query');

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

  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
    direction: 'column',
    initialSize: 0.2,
  });

  return (
    <Drawer
      size="lg"
      title={t('dashboard.edit-pane.variable.query-options.modal-title', 'Query variable editor')}
      subtitle={
        <Stack direction="row" gap={2} justifyContent="space-between">
          <div className={styles.variableName}>{draftVariable.state.name}</div>
          <Stack direction="row" gap={1} justifyContent="space-between">
            <Button
              variant="primary"
              onClick={onClickApply}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.applyButton}
            >
              <Trans i18nKey="dashboard-scene.modal-editor.apply">Apply</Trans>
            </Button>
            <Button
              variant="secondary"
              fill="outline"
              onClick={onCloseModal}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.closeButton}
            >
              <Trans i18nKey="dashboard-scene.modal-editor.discard">Discard</Trans>
            </Button>
          </Stack>
        </Stack>
      }
      closeOnMaskClick={false}
      onClose={onCloseModal}
      scrollableContent={false}
    >
      <div className={styles.wrapper}>
        <div className={styles.buttonsRow}>
          <Stack direction="row" gap={1} justifyContent="space-between">
            <h5>
              <Trans i18nKey="dashboard-scene.modal-editor.preview-of-values" values={{ optionsCount: options.length }}>
                Preview of values ({'{{ optionsCount }}'})
              </Trans>
            </h5>
            <Button
              variant="secondary"
              onClick={previewValues}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton}
            >
              {isLoading ? (
                <Spinner inline />
              ) : (
                <Trans i18nKey="dashboard-scene.modal-editor.run-query">Run query</Trans>
              )}
            </Button>
          </Stack>
        </div>
        <div className={styles.content}>
          <div {...containerProps}>
            <div {...primaryProps} style={{ ...primaryProps.style, minHeight: 0 }}>
              <div className={styles.splitContainer}>
                {!options.length ? (
                  <div className={styles.noOptions}>
                    <Trans i18nKey="dashboard-scene.modal-editor.no-options-hint">
                      Provide a valid query and click the &quot;Run query&quot; button to see a preview of the variable
                      options.
                    </Trans>
                  </div>
                ) : (
                  <VariableValuesPreview options={options} staticOptions={staticOptions ?? []} noPagination hideTitle />
                )}
              </div>
            </div>
            <div {...splitterProps} />
            <div {...secondaryProps} style={{ ...secondaryProps.style, minHeight: 0 }}>
              <div className={styles.splitContainer}>
                <TabsBar>
                  <Tab
                    label={t('dashboard.edit-pane.variable.query-options.tabs.query', 'Query')}
                    active={activeTab === 'query'}
                    onChangeTab={() => setActiveTab('query')}
                  />
                  <Tab
                    label={t(
                      'dashboard-scene.modal-editor.label-static-options',
                      'Static options ({{staticOptionsCount}})',
                      { staticOptionsCount: staticOptions.length }
                    )}
                    active={activeTab === 'staticOptions'}
                    onChangeTab={() => setActiveTab('staticOptions')}
                  />
                </TabsBar>
                <div className={styles.tabContent}>
                  {activeTab === 'query' && (
                    <>
                      {queryError && <Alert title={queryError.message} severity="error" />}
                      <Editor variable={draftVariable} />
                    </>
                  )}
                  {activeTab === 'staticOptions' && (
                    <QueryVariableStaticOptions
                      options={options}
                      staticOptions={staticOptions}
                      staticOptionsOrder={staticOptionsOrder}
                      onStaticOptionsChange={onStaticOptionsChange}
                      onStaticOptionsOrderChange={onStaticOptionsOrderChange}
                      hideTitle
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
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

// Rename
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
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      margin: theme.spacing(0),
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'hidden',
      margin: theme.spacing(0),
    }),
    splitContainer: css({
      width: '100%',
      overflow: 'auto',
      margin: theme.spacing(1, 0),
    }),
    tabContent: css({
      marginTop: theme.spacing(4),
    }),
    noOptions: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      color: theme.colors.text.secondary,
    }),
    buttonsRow: css({
      marginBottom: theme.spacing(1),
      flexShrink: 0,
    }),
    variableName: css({
      fontSize: theme.typography.h4.fontSize,
    }),
  };
}
