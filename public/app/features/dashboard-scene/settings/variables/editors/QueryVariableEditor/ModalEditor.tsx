import { css, cx } from '@emotion/css';
import { useRef, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { QueryVariable, type VariableValueOption, type VariableValueOptionProperties } from '@grafana/scenes';
import { Alert, Button, Modal, Spinner, Stack, Tab, TabsBar, useSplitter, useStyles2 } from '@grafana/ui';
import { dashboardEditActions } from 'app/features/dashboard-scene/edit-pane/shared';
import {
  type StaticOptionsOrderType,
  type StaticOptionsType,
} from 'app/features/variables/query/QueryVariableStaticOptions';

import { getPropertiesFromOptions, VariableValuesPreview } from '../../components/VariableValuesPreview';

import { Editor } from './QueryVariableEditor';
import { VariableOptionsSpreadsheet } from './VariableOptionsSpreadsheet';

type ModalEditorProps = {
  variable: QueryVariable;
  onClose: () => void;
};

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
    <Modal
      title={t('dashboard.edit-pane.variable.query-options.modal-title', 'Query variable: {{name}}', {
        name: draftVariable.state.name,
      })}
      isOpen={true}
      onDismiss={onCloseModal}
      closeOnBackdropClick={false}
      closeOnEscape={false}
      className={styles.modal}
      contentClassName={styles.modalContent}
    >
      <div className={styles.buttonsRow}>
        <Stack direction="row" gap={1} justifyContent="space-between">
          <div className={styles.previewTitle}>
            <Trans i18nKey="dashboard-scene.modal-editor.preview-of-values" values={{ optionsCount: options.length }}>
              Preview of values ({'{{ optionsCount }}'})
            </Trans>
          </div>
          {options.length > 0 && (
            <Button
              variant={isLoading ? 'secondary' : 'primary'}
              fill="outline"
              size="sm"
              onClick={previewValues}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton}
            >
              {isLoading ? (
                <Spinner inline />
              ) : (
                <Trans i18nKey="dashboard-scene.modal-editor.refresh-preview">Refresh preview</Trans>
              )}
            </Button>
          )}
        </Stack>
      </div>
      <div className={styles.content}>
        <div {...containerProps}>
          <div {...primaryProps} style={{ ...primaryProps.style, minHeight: 0 }}>
            <div className={styles.splitContainer}>
              {!options.length ? (
                <div className={styles.noOptions}>
                  <Button
                    variant="secondary"
                    fill="outline"
                    onClick={previewValues}
                    data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton}
                  >
                    {isLoading ? (
                      <Spinner inline />
                    ) : (
                      <Trans i18nKey="dashboard-scene.modal-editor.show-preview">Show preview</Trans>
                    )}
                  </Button>
                </div>
              ) : (
                <VariableValuesPreview options={options} staticOptions={staticOptions ?? []} noPagination hideTitle />
              )}
            </div>
          </div>
          <div
            {...splitterProps}
            className={cx(splitterProps.className, styles.splitter)}
            title={t('dashboard-scene.modal-editor.content-drag-to-resize', 'Drag to resize')}
          >
            <div className={styles.fadeOverlay} />
          </div>
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
                  <VariableOptionsSpreadsheet
                    options={options}
                    staticOptions={staticOptions}
                    staticOptionsOrder={staticOptionsOrder}
                    onStaticOptionsChange={onStaticOptionsChange}
                    onStaticOptionsOrderChange={onStaticOptionsOrderChange}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Modal.ButtonRow>
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
      </Modal.ButtonRow>
    </Modal>
  );
}

function useDraftVariable(variable: QueryVariable) {
  const draftVariableRef = useRef<QueryVariable>();
  if (!draftVariableRef.current) {
    draftVariableRef.current = new QueryVariable(variable.state);
  }
  const initialStateRef = useRef({ ...variable.state });
  return { draftVariable: draftVariableRef.current, initialState: initialStateRef.current };
}

function useModalEditor({ variable, onClose }: ModalEditorProps) {
  const { draftVariable, initialState } = useDraftVariable(variable);
  const { options, staticOptions = [], staticOptionsOrder } = draftVariable.useState();
  const [queryError, setQueryError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(false);

  const updateVariable = async (targetVariable: QueryVariable, stateUpdate?: Partial<QueryVariable['state']>) => {
    if (stateUpdate) {
      if (stateUpdate.staticOptions && stateUpdate.options) {
        const validProperties = getPropertiesFromOptions(stateUpdate.options, stateUpdate.staticOptions);
        stateUpdate = {
          ...stateUpdate,
          staticOptions: reconcileStaticOptionsProperties(stateUpdate.staticOptions, validProperties),
        };
      }
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

function reconcileStaticOptionsProperties(
  staticOptions: VariableValueOption[],
  validProperties: string[]
): VariableValueOption[] {
  const propertyKeys = validProperties.filter((p) => p !== 'value' && p !== 'text');
  if (propertyKeys.length === 0) {
    return staticOptions.map(({ properties: _, ...rest }) => rest);
  }

  return staticOptions.map((option) => {
    const reconciled: VariableValueOptionProperties = {};
    for (const key of propertyKeys) {
      reconciled[key] = option.properties?.[key] ?? '';
    }
    return { ...option, properties: reconciled };
  });
}

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '90vw',
      height: '90vh',
      maxWidth: '90vw',
    }),
    modalContent: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
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
      padding: theme.spacing(3, 1),
    }),
    noOptions: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    }),
    buttonsRow: css({
      flexShrink: 0,
      marginBottom: theme.spacing(1.5),
    }),
    variableName: css({
      fontSize: theme.typography.h4.fontSize,
    }),
    previewTitle: css({
      fontSize: '16px',
    }),
    splitter: css({
      '&&::after': {
        width: '400px',
      },
    }),
    fadeOverlay: css({
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: theme.spacing(3),
      height: `calc(${theme.spacing(3)} + 48px)`,
      background: `linear-gradient(transparent, ${theme.colors.background.primary})`,
      pointerEvents: 'none',
    }),
  };
}
