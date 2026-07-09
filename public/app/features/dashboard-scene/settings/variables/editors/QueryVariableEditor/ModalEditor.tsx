import { css, cx } from '@emotion/css';
import { useRef, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import {
  QueryVariable,
  sceneGraph,
  SceneTimeRange,
  type VariableValueOption,
  type VariableValueOptionProperties,
} from '@grafana/scenes';
import { Alert, Button, Modal, Spinner, Stack, Tab, TabsBar, Text, useSplitter, useStyles2 } from '@grafana/ui';
import { dashboardEditActions } from 'app/features/dashboard-scene/edit-pane/shared';
import {
  type StaticOptionsOrderType,
  type StaticOptionsType,
} from 'app/features/variables/query/QueryVariableStaticOptions';

import { getPropertiesFromOptions, VariableValuesPreview } from '../../components/VariableValuesPreview';

import { Editor } from './QueryVariableEditor';
import { VariableOptionsSpreadsheet } from './VariableOptionsSpreadsheet/VariableOptionsSpreadsheet';

type ModalEditorProps = {
  variable: QueryVariable;
  onClose: () => void;
};

export function ModalEditor(props: ModalEditorProps) {
  const styles = useStyles2(getStyles);
  const [activeTab, setActiveTab] = useState<'query' | 'staticOptions'>('query');
  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
    direction: 'column',
    initialSize: 0.25,
  });

  const {
    draftVariable,
    options,
    staticOptions,
    staticOptionsOrder,
    hasRunQuery,
    noValuesFound,
    isLoading,
    queryError,
    onStaticOptionsChange,
    onStaticOptionsOrderChange,
    onRunQuery,
    onCloseModal,
    onClickApply,
  } = useModalEditor(props);

  return (
    <Modal
      title={t('dashboard-scene.query-variable-editor.modal.title', 'Query variable: {{name}}', {
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
            <Trans
              i18nKey="dashboard-scene.query-variable-editor.modal.preview-of-values"
              values={{ optionsCount: options.length }}
            >
              Preview of values ({'{{ optionsCount }}'})
            </Trans>
          </div>
          {hasRunQuery && (
            <Button
              variant={isLoading ? 'secondary' : 'primary'}
              fill="outline"
              size="sm"
              onClick={onRunQuery}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton}
            >
              {isLoading ? (
                <Spinner inline />
              ) : (
                <Trans i18nKey="dashboard-scene.query-variable-editor.modal.run-query">Run query</Trans>
              )}
            </Button>
          )}
        </Stack>
      </div>
      <div className={styles.content}>
        <div {...containerProps}>
          <div {...primaryProps} style={{ ...primaryProps.style, minHeight: '16px' }}>
            <div className={styles.splitContainer}>
              {queryError && <Alert title={queryError.message} severity="error" />}
              {!options.length ? (
                <div className={styles.noOptions}>
                  {noValuesFound && (
                    <Stack direction="column" alignItems="center" gap={0.5}>
                      <Text weight="medium">
                        <Trans i18nKey="dashboard-scene.query-variable-editor.modal.no-values-found">
                          No values found
                        </Trans>
                      </Text>
                      {staticOptions.length > 0 && (
                        <Text color="secondary">
                          <Trans i18nKey="dashboard-scene.query-variable-editor.modal.static-options-require-query">
                            Static options only appear once a query is set.
                          </Trans>
                        </Text>
                      )}
                    </Stack>
                  )}
                  {!hasRunQuery && (
                    <Button
                      variant="primary"
                      fill="outline"
                      onClick={onRunQuery}
                      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.previewButton}
                    >
                      {isLoading ? (
                        <Spinner inline />
                      ) : (
                        <Trans i18nKey="dashboard-scene.query-variable-editor.modal.run-query">Run query</Trans>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <VariableValuesPreview options={options} staticOptions={staticOptions} pageSize={1000} hideTitle />
              )}
            </div>
          </div>
          <div
            {...splitterProps}
            className={cx(splitterProps.className, styles.splitter)}
            title={t('dashboard-scene.query-variable-editor.modal.drag-to-resize', 'Drag to resize')}
          >
            <div className={styles.fadeOverlay} />
          </div>
          <div {...secondaryProps} style={{ ...secondaryProps.style, minHeight: '16px' }}>
            <div className={styles.splitContainer}>
              <TabsBar>
                <Tab
                  label={t('dashboard-scene.query-variable-editor.modal.tabs.query', 'Query')}
                  active={activeTab === 'query'}
                  onChangeTab={() => setActiveTab('query')}
                />
                <Tab
                  label={t(
                    'dashboard-scene.query-variable-editor.modal.tabs.static-options',
                    'Static options ({{staticOptionsCount}})',
                    {
                      staticOptionsCount: staticOptions.length,
                    }
                  )}
                  active={activeTab === 'staticOptions'}
                  onChangeTab={() => setActiveTab('staticOptions')}
                />
              </TabsBar>
              <div className={styles.tabContent}>
                {activeTab === 'query' && <Editor variable={draftVariable} hideRefresh hideStaticOptions hidePreview />}
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
          <Trans i18nKey="dashboard-scene.query-variable-editor.modal.apply">Apply</Trans>
        </Button>
        <Button
          variant="secondary"
          fill="outline"
          onClick={onCloseModal}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.closeButton}
        >
          <Trans i18nKey="dashboard-scene.query-variable-editor.modal.discard">Discard</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

function useDraftVariable(variable: QueryVariable) {
  const draftVariableRef = useRef<QueryVariable>();
  if (!draftVariableRef.current) {
    const timeRange = sceneGraph.getTimeRange(variable);
    draftVariableRef.current = new QueryVariable({
      ...variable.state,
      $timeRange: new SceneTimeRange(timeRange.state),
    });
  }
  const initialStateRef = useRef({ ...variable.state });
  return { draftVariable: draftVariableRef.current, initialState: initialStateRef.current };
}

function useModalEditor({ variable, onClose }: ModalEditorProps) {
  const { draftVariable, initialState } = useDraftVariable(variable);
  const { options, staticOptions = [], staticOptionsOrder } = draftVariable.useState();
  const [queryError, setQueryError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasRunQuery, setHasRunQuery] = useState(false);

  const updateVariable = async (targetVariable: QueryVariable, stateUpdate?: Partial<QueryVariable['state']>) => {
    if (stateUpdate) {
      if (stateUpdate.staticOptions && stateUpdate.options) {
        const validProperties = getPropertiesFromOptions(stateUpdate.options, stateUpdate.staticOptions);
        stateUpdate = {
          ...stateUpdate,
          staticOptions: reconcileStaticOptionsProperties(stateUpdate.staticOptions, validProperties),
        };
      }
      // Exclude computed properties so that validateAndUpdate() detects the value
      // change and publishes SceneVariableValueChangedEvent, which notifies dependent
      // scene objects (e.g. panels with interpolated titles) to re-render.
      const {
        value: _,
        text: __,
        options: ___,
        loading: ____,
        error: _____,
        $timeRange: ______,
        ...configState
      } = stateUpdate;
      targetVariable.setState(configState);
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

  const onStaticOptionsChange = (staticOptions: StaticOptionsType) => {
    draftVariable.setState({ staticOptions });
  };
  const onStaticOptionsOrderChange = (staticOptionsOrder: StaticOptionsOrderType) => {
    // we force a query to run so the user does not have to click the "Refresh preview" button after selecting a new sort criteria
    // compared to the above, this case is less frequent so querying each time the sort order changes is more affordable in terms of performance
    updateVariable(draftVariable, { staticOptionsOrder });
  };

  const onClickApply = async () => {
    dashboardEditActions.edit({
      source: variable,
      description: t('dashboard-scene.query-variable-editor.modal.apply-description', 'Change variable query'),
      perform: async () => {
        updateVariable(variable, draftVariable.state);
        onClose();
      },
      undo: async () => {
        variable.setState(initialState);
        await lastValueFrom(variable.validateAndUpdate());
      },
    });
  };

  return {
    draftVariable,
    options: options ?? [],
    staticOptions,
    staticOptionsOrder,
    hasRunQuery,
    noValuesFound: hasRunQuery && !isLoading && !queryError && (options ?? []).length === 0,
    isLoading,
    queryError,
    onStaticOptionsChange,
    onStaticOptionsOrderChange,
    onCloseModal: onClose,
    onRunQuery: async () => {
      await updateVariable(draftVariable);
      setHasRunQuery(true);
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
      paddingTop: theme.spacing(2),
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
    previewTitle: css({
      fontSize: '14px',
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
      bottom: 0,
      // Fades ~1.5 table rows above the splitter to hint at truncated content
      height: `calc(${theme.spacing(3)} + 48px)`,
      background: `linear-gradient(transparent, ${theme.colors.background.primary})`,
      pointerEvents: 'none',
    }),
  };
}
