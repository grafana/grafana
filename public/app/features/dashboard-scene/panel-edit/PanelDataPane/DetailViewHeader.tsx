import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { mergeMap } from 'rxjs/operators';

import {
  CoreApp,
  DataFrame,
  DataQuery,
  DataSourceInstanceSettings,
  DataTransformerConfig,
  DataTransformContext,
  GrafanaTheme2,
  standardTransformersRegistry,
  transformDataFrame,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import {
  Button,
  Drawer,
  Dropdown,
  FieldValidationMessage,
  Icon,
  IconButton,
  Input,
  JSONFormatter,
  Menu,
  Stack,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { FALLBACK_DOCS_LINK } from 'app/features/transformers/docs/constants';

import { getQueryRunnerFor } from '../../utils/utils';

import { QueryTransformItem } from './types';

// Props for regular item mode
interface ItemModeProps {
  selectedItem: QueryTransformItem;
  panel: VizPanel;
  onRemoveTransform?: (index: number) => void;
  onToggleTransformVisibility?: (index: number) => void;
  onOpenQueryLibrary?: (mode: 'browse' | 'save') => void;
  onOpenQueryInspector?: () => void;
  isDebugMode?: boolean;
  debugPosition?: number;
  queryLibraryMode?: never;
  onSelectQuery?: never;
  onClose?: never;
}

// Props for query library mode
interface QueryLibraryModeProps {
  selectedItem?: never;
  panel?: never;
  onRemoveTransform?: never;
  onToggleTransformVisibility?: never;
  onOpenQueryLibrary?: never;
  onOpenQueryInspector?: never;
  queryLibraryMode: 'browse' | 'save';
  onSelectQuery?: () => void;
  onSaveQuery?: () => void;
  onClose: () => void;
}

type DetailViewHeaderProps = ItemModeProps | QueryLibraryModeProps;

const ITEM_CONFIG = (theme: GrafanaTheme2) => ({
  query: {
    color: theme.colors.primary.main,
    icon: 'database' as const,
  },
  expression: {
    color: theme.visualization.getColorByName('purple'),
    icon: 'calculator-alt' as const,
  },
  transform: {
    color: theme.visualization.getColorByName('orange'),
    icon: 'process' as const,
  },
  queryLibrary: {
    color: theme.visualization.getColorByName('green'),
    icon: 'bookmark' as const,
  },
});

// Separate component for query library header to avoid conditional hooks
function QueryLibraryHeader({
  mode,
  onSelectQuery,
  onSaveQuery,
  onClose,
}: {
  mode: 'browse' | 'save';
  onSelectQuery?: () => void;
  onSaveQuery?: () => void;
  onClose: () => void;
}) {
  const theme = useTheme2();
  const config = useMemo(() => ITEM_CONFIG(theme).queryLibrary, [theme]);
  const styles = useStyles2(getStyles, config);

  return (
    <div className={styles.header}>
      <div className={styles.headerContent}>
        <Stack gap={1} alignItems="center" grow={1} minWidth={0}>
          <Icon name="gf-query-library" />
          <span className={styles.transformName}>{t('query-library.header.title', 'SAVED QUERIES')}</span>
        </Stack>
        <Stack gap={0.5} alignItems="center">
          {mode === 'browse' && onSelectQuery && (
            <Button className={styles.monospace} variant="primary" fill="text" size="sm" onClick={onSelectQuery}>
              {t('query-library.header.select-query', 'SELECT QUERY')}
            </Button>
          )}
          {mode === 'save' && onSaveQuery && (
            <Button className={styles.monospace} variant="primary" fill="text" size="sm" onClick={onSaveQuery}>
              {t('query-library.header.save-query', 'SAVE')}
            </Button>
          )}
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item
                  label={t('query-library.header.delete-all', 'Delete all')}
                  icon="trash-alt"
                  onClick={() => {}}
                />
              </Menu>
            }
          >
            <IconButton name="ellipsis-v" variant="secondary" tooltip={t('query-library.header.more', 'More')} />
          </Dropdown>
          <IconButton
            name="times"
            variant="secondary"
            onClick={onClose}
            tooltip={t('query-library.header.close', 'Close')}
          />
        </Stack>
      </div>
    </div>
  );
}

// Separate component for item header to keep hooks unconditional
function ItemHeader({
  selectedItem,
  panel,
  onRemoveTransform,
  onToggleTransformVisibility,
  onOpenQueryLibrary,
  onOpenQueryInspector,
  isDebugMode,
  debugPosition,
}: ItemModeProps) {
  const theme = useTheme2();
  const config = useMemo(() => ITEM_CONFIG(theme)[selectedItem.type], [theme, selectedItem.type]);
  const styles = useStyles2(getStyles, config);

  const [isEditing, setIsEditing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [transformInput, setTransformInput] = useState<DataFrame[]>([]);
  const [transformOutput, setTransformOutput] = useState<DataFrame[]>([]);

  // Helper to update queries with consistent pattern
  const updateQueries = useCallback(
    (updater: (queries: DataQuery[]) => DataQuery[], runAfter = false) => {
      const queryRunner = getQueryRunnerFor(panel);
      if (!queryRunner) {
        return;
      }

      const queries = queryRunner.state.queries || [];
      const newQueries = updater(queries);
      queryRunner.setState({ queries: newQueries });

      if (runAfter) {
        queryRunner.runQueries();
      }
    },
    [panel]
  );

  // Get datasource settings for queries
  const datasourceSettings = useMemo(() => {
    if (selectedItem.type === 'query') {
      try {
        // If the query has a datasource, use it; otherwise get the default datasource
        const datasource = 'datasource' in selectedItem.data ? selectedItem.data.datasource : null;
        return getDataSourceSrv().getInstanceSettings(datasource);
      } catch {
        return getDataSourceSrv().getInstanceSettings(null);
      }
    }
    return undefined;
  }, [selectedItem]);

  const queryRunner = getQueryRunnerFor(panel);

  // Handle datasource change for queries
  const handleDataSourceChange = useCallback(
    async (newDsSettings: DataSourceInstanceSettings) => {
      if (selectedItem.type !== 'query' || selectedItem.index === undefined) {
        return;
      }

      try {
        // Load the new datasource to get its default query
        const newDatasource = await getDataSourceSrv().get(newDsSettings.uid);
        const defaultQuery = newDatasource.getDefaultQuery?.(CoreApp.PanelEditor) || {};

        const queryRunner = getQueryRunnerFor(panel);
        if (!queryRunner) {
          return;
        }

        const queries = queryRunner.state.queries || [];
        const newQueries = queries.map((q, idx) => {
          if (idx === selectedItem.index) {
            // Merge default query with existing query to preserve properties
            return {
              ...defaultQuery,
              ...q,
              datasource: { uid: newDsSettings.uid, type: newDsSettings.type },
              refId: q.refId,
            };
          }
          return q;
        });

        // Update queries, datasource, and clear cached data
        queryRunner.setState({
          datasource: { uid: newDsSettings.uid, type: newDsSettings.type },
          queries: newQueries,
          data: undefined,
        });

        // Run the query with the new datasource
        queryRunner.runQueries();
      } catch (error) {
        console.error('Error changing datasource:', error);
      }
    },
    [selectedItem, panel]
  );

  // Handle query name editing
  const onEditQueryName = useCallback(() => {
    setIsEditing(true);
  }, []);

  const onEndEditName = useCallback(
    (newName: string) => {
      setIsEditing(false);

      // Ignore change if invalid
      if (validationError) {
        setValidationError(null);
        return;
      }

      if (!('refId' in selectedItem.data) || selectedItem.data.refId === newName || selectedItem.index === undefined) {
        return;
      }

      // Update the query with the new refId - just update state, don't run queries
      updateQueries((queries) => queries.map((q, idx) => (idx === selectedItem.index ? { ...q, refId: newName } : q)));
    },
    [selectedItem, validationError, updateQueries]
  );

  const onInputChange = useCallback(
    (event: React.SyntheticEvent<HTMLInputElement>) => {
      const newName = event.currentTarget.value.trim();

      if (newName.length === 0) {
        setValidationError('An empty query name is not allowed');
        return;
      }

      for (const otherQuery of queryRunner?.state.queries || []) {
        if (otherQuery !== selectedItem.data && newName === otherQuery.refId) {
          setValidationError('Query name already exists');
          return;
        }
      }

      if (validationError) {
        setValidationError(null);
      }
    },
    [queryRunner, selectedItem.data, validationError]
  );

  const onEditQueryBlur = useCallback(
    (event: React.SyntheticEvent<HTMLInputElement>) => {
      onEndEditName(event.currentTarget.value.trim());
    },
    [onEndEditName]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        onEndEditName(event.currentTarget.value);
      }
    },
    [onEndEditName]
  );

  const onFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  }, []);

  // Action handlers
  const onCopyQuery = useCallback(() => {
    if (selectedItem.index === undefined) {
      return;
    }

    updateQueries((queries) => {
      const queryToCopy = queries[selectedItem.index];
      return queryToCopy ? [...queries, { ...queryToCopy }] : queries;
    });
  }, [selectedItem, updateQueries]);

  const onRemoveQuery = useCallback(() => {
    if (selectedItem.index === undefined) {
      return;
    }

    updateQueries((queries) => queries.filter((_, idx) => idx !== selectedItem.index));
  }, [selectedItem, updateQueries]);

  const onToggleHideQuery = useCallback(() => {
    if ((selectedItem.type !== 'query' && selectedItem.type !== 'expression') || selectedItem.index === undefined) {
      return;
    }

    updateQueries(
      (queries) => queries.map((q, idx) => (idx === selectedItem.index ? { ...q, hide: !q.hide } : q)),
      true // Run queries after update
    );
  }, [selectedItem, updateQueries]);

  const onRunQuery = useCallback(() => {
    const queryRunner = getQueryRunnerFor(panel);
    queryRunner?.runQueries();
  }, [panel]);

  // Transformation action handlers
  const onRemoveTransformation = useCallback(() => {
    if (selectedItem.type !== 'transform' || selectedItem.index === undefined) {
      return;
    }
    onRemoveTransform?.(selectedItem.index);
  }, [selectedItem, onRemoveTransform]);

  const onToggleTransformationVisibility = useCallback(() => {
    if (selectedItem.type !== 'transform' || selectedItem.index === undefined) {
      return;
    }
    onToggleTransformVisibility?.(selectedItem.index);
  }, [selectedItem, onToggleTransformVisibility]);

  const refId = 'refId' in selectedItem.data ? selectedItem.data.refId : '';
  const isHidden =
    (selectedItem.type === 'query' || selectedItem.type === 'expression') &&
    'hide' in selectedItem.data &&
    selectedItem.data.hide;

  const isTransformDisabled =
    selectedItem.type === 'transform' && 'disabled' in selectedItem.data && selectedItem.data.disabled;

  // Get transformation display name and transformer info
  const transformerInfo = useMemo(() => {
    if (selectedItem.type === 'transform' && 'id' in selectedItem.data) {
      const transformId = selectedItem.data.id;
      const transformer = standardTransformersRegistry.get(transformId);
      return transformer;
    }
    return undefined;
  }, [selectedItem]);

  const transformationName = transformerInfo?.name || '';

  // Calculate transformation input/output for debug mode
  useEffect(() => {
    if (selectedItem.type !== 'transform' || !showDebug || !('disabled' in selectedItem.data)) {
      return;
    }

    // Get the query runner for source data
    const queryRunner = getQueryRunnerFor(panel);
    if (!queryRunner) {
      return;
    }

    // Get the source data (before any transformations)
    const sourceData = queryRunner.state.data;
    if (!sourceData?.series || sourceData.series.length === 0) {
      setTransformInput([]);
      setTransformOutput([]);
      return;
    }

    // Get all transformations from the panel's data transformer
    const $data = panel.state.$data;
    if (!$data || !('state' in $data) || !('transformations' in $data.state)) {
      return;
    }

    const transformations = $data.state.transformations;
    if (!Array.isArray(transformations)) {
      return;
    }

    const allTransformations: DataTransformerConfig[] = transformations;

    // In debug mode, use debugPosition to determine which transformations to apply
    // debugPosition is relative to all items (queries + transforms)
    // We need to calculate the transformation index from it
    let currentIndex = selectedItem.index;
    if (isDebugMode && debugPosition !== undefined) {
      // debugPosition is the number of enabled items
      // To get transformation index: debugPosition - number_of_queries
      // Number of queries = debugPosition - allTransformations.length (approximately, but we need to get it properly)
      // Actually, let's get the number of queries from queryRunner
      const numQueries = queryRunner.state.queries?.length || 0;
      const maxTransformIndex = Math.max(0, (debugPosition || 0) - numQueries);
      // Use the minimum of the calculated index and the current selected index
      // This ensures we don't go beyond what's enabled in debug mode
      currentIndex = Math.min(selectedItem.index, maxTransformIndex - 1);
    }

    // Get transformations before and including current one
    const inputTransforms = allTransformations.slice(0, Math.max(0, currentIndex));
    const outputTransforms = allTransformations.slice(Math.max(0, currentIndex), Math.max(0, currentIndex) + 1);

    const ctx: DataTransformContext = {
      interpolate: (v: string) => getTemplateSrv().replace(v),
    };

    // Input: Apply all transformations before this one to the source data
    const inputSubscription = transformDataFrame(inputTransforms, sourceData.series, ctx).subscribe((frames) => {
      setTransformInput(frames);
    });

    // Output: Apply input transforms, then apply the current transform to get the output
    const outputSubscription = transformDataFrame(inputTransforms, sourceData.series, ctx)
      .pipe(mergeMap((before) => transformDataFrame(outputTransforms, before, ctx)))
      .subscribe((frames) => {
        setTransformOutput(frames);
      });

    return () => {
      inputSubscription.unsubscribe();
      outputSubscription.unsubscribe();
    };
  }, [selectedItem, showDebug, panel, isDebugMode, debugPosition]);

  return (
    <div className={styles.header}>
      <div className={styles.headerContent}>
        {/* Left side: Icon, Datasource, Name */}
        <Stack gap={1} alignItems="center" grow={1} minWidth={0}>
          <Icon name={config.icon} className={styles.icon} />

          {/* Datasource picker for queries */}
          {selectedItem.type === 'query' && datasourceSettings && (
            <DataSourcePicker
              dashboard={true}
              variables={true}
              current={datasourceSettings.name}
              onChange={handleDataSourceChange}
            />
          )}

          {/* Transformation name */}
          {selectedItem.type === 'transform' && transformationName && (
            <span className={styles.transformName}>{transformationName}</span>
          )}

          {/* Editable query/expression name */}
          {(selectedItem.type === 'query' || selectedItem.type === 'expression') && refId && (
            <>
              {!isEditing ? (
                <button
                  className={cx(styles.queryNameWrapper, styles.monospace)}
                  title={t('dashboard-scene.detail-view-header.edit-query-name', 'Edit query name')}
                  onClick={onEditQueryName}
                  type="button"
                >
                  <span className={styles.queryName}>{refId}</span>
                  <Icon name="pen" className={styles.queryEditIcon} size="sm" />
                </button>
              ) : (
                <>
                  <Input
                    type="text"
                    defaultValue={refId}
                    onBlur={onEditQueryBlur}
                    autoFocus
                    onKeyDown={onKeyDown}
                    onFocus={onFocus}
                    invalid={validationError !== null}
                    onChange={onInputChange}
                    className={styles.queryNameInput}
                  />
                  {validationError && <FieldValidationMessage horizontal>{validationError}</FieldValidationMessage>}
                </>
              )}
            </>
          )}
        </Stack>

        {/* Right side: Run Query + Actions Menu for queries/expressions */}
        {(selectedItem.type === 'query' || selectedItem.type === 'expression') && (
          <Stack gap={0.5} alignItems="center">
            {/* Save Query Button (only for queries, not expressions) */}
            {selectedItem.type === 'query' && 'refId' in selectedItem.data && onOpenQueryLibrary && (
              <Button
                className={styles.monospace}
                variant="primary"
                fill="text"
                size="sm"
                icon="bookmark"
                onClick={() => onOpenQueryLibrary('save')}
              >
                {t('dashboard-scene.detail-view-header.save-query', 'SAVE')}
              </Button>
            )}
            <Button
              className={styles.monospace}
              variant="primary"
              fill="text"
              size="sm"
              onClick={onRunQuery}
              icon="play"
            >
              {t('dashboard-scene.detail-view-header.run-query', 'RUN QUERY')}
            </Button>
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item
                    label={t('dashboard-scene.detail-view-header.duplicate-query', 'Duplicate')}
                    icon="copy"
                    onClick={onCopyQuery}
                  />
                  <Menu.Item
                    label={
                      isHidden
                        ? t('dashboard-scene.detail-view-header.show-response', 'Show response')
                        : t('dashboard-scene.detail-view-header.hide-response', 'Hide response')
                    }
                    icon={isHidden ? 'eye-slash' : 'eye'}
                    onClick={onToggleHideQuery}
                  />
                  <Menu.Divider />
                  <Menu.Item
                    label={t('dashboard-scene.detail-view-header.remove-query', 'Remove')}
                    icon="trash-alt"
                    onClick={onRemoveQuery}
                  />
                  <Menu.Item
                    label={t('dashboard-scene.detail-view-header.query-inspector', 'Query inspector')}
                    icon="wrench"
                    onClick={onOpenQueryInspector}
                  />
                </Menu>
              }
            >
              <IconButton
                name="ellipsis-v"
                variant="secondary"
                tooltip={t('dashboard-scene.detail-view-header.actions', 'Actions')}
              />
            </Dropdown>
          </Stack>
        )}

        {/* Right side: Actions Menu for transformations */}
        {selectedItem.type === 'transform' && (
          <Stack gap={0.5} alignItems="center">
            <IconButton
              name="question-circle"
              variant="secondary"
              tooltip={t('dashboard-scene.detail-view-header.show-documentation', 'Show documentation')}
              onClick={() => setShowHelp(true)}
            />
            <IconButton
              name="bug"
              variant="secondary"
              tooltip={t('dashboard-scene.detail-view-header.debug', 'Debug transformation')}
              onClick={() => setShowDebug(!showDebug)}
            />
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item
                    label={
                      isTransformDisabled
                        ? t('dashboard-scene.detail-view-header.enable-transform', 'Enable')
                        : t('dashboard-scene.detail-view-header.disable-transform', 'Disable')
                    }
                    icon={isTransformDisabled ? 'eye' : 'eye-slash'}
                    onClick={onToggleTransformationVisibility}
                  />
                  <Menu.Divider />
                  <Menu.Item
                    label={t('dashboard-scene.detail-view-header.remove-transform', 'Remove')}
                    icon="trash-alt"
                    onClick={onRemoveTransformation}
                  />
                </Menu>
              }
            >
              <IconButton
                name="ellipsis-v"
                variant="secondary"
                tooltip={t('dashboard-scene.detail-view-header.actions', 'Actions')}
              />
            </Dropdown>
          </Stack>
        )}
      </div>

      {/* Transformation Help Drawer */}
      {selectedItem.type === 'transform' && transformerInfo && showHelp && (
        <Drawer
          title={transformerInfo.name}
          subtitle={t('dashboard-scene.detail-view-header.transformation-help', 'Transformation help')}
          onClose={() => setShowHelp(false)}
        >
          <OperationRowHelp
            markdown={transformerInfo.help || FALLBACK_DOCS_LINK}
            styleOverrides={{ borderTop: '2px solid' }}
          />
        </Drawer>
      )}

      {/* Transformation Debug Drawer */}
      {selectedItem.type === 'transform' && showDebug && (
        <Drawer
          title={t('dashboard-scene.detail-view-header.debug-transformation', 'Debug transformation')}
          subtitle={transformationName}
          onClose={() => setShowDebug(false)}
        >
          <div className={styles.debugWrapper}>
            <div className={styles.debug}>
              <div className={styles.debugTitle}>
                <Trans i18nKey="dashboard-scene.detail-view-header.input-data">Input data</Trans>
              </div>
              <div className={styles.debugJson}>
                <JSONFormatter json={transformInput} />
              </div>
            </div>
            <div className={styles.debugSeparator}>
              <Icon name="arrow-right" />
            </div>
            <div className={styles.debug}>
              <div className={styles.debugTitle}>
                <Trans i18nKey="dashboard-scene.detail-view-header.output-data">Output data</Trans>
              </div>
              <div className={styles.debugJson}>
                <JSONFormatter json={transformOutput} />
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

// Main component that delegates to the appropriate sub-component
export const DetailViewHeader = (props: DetailViewHeaderProps) => {
  if (props.queryLibraryMode) {
    return (
      <QueryLibraryHeader
        mode={props.queryLibraryMode}
        onSelectQuery={props.onSelectQuery}
        onSaveQuery={props.onSaveQuery}
        onClose={props.onClose}
      />
    );
  }

  return (
    <ItemHeader
      selectedItem={props.selectedItem}
      panel={props.panel}
      onRemoveTransform={props.onRemoveTransform}
      onToggleTransformVisibility={props.onToggleTransformVisibility}
      onOpenQueryLibrary={props.onOpenQueryLibrary}
      onOpenQueryInspector={props.onOpenQueryInspector}
      isDebugMode={props.isDebugMode}
      debugPosition={props.debugPosition}
    />
  );
};

const getStyles = (theme: GrafanaTheme2, config: { color: string }) => {
  return {
    monospace: css({
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
    header: css({
      padding: theme.spacing(0.5),
      borderLeft: `4px solid ${config.color}`,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
      minHeight: theme.spacing(6),
    }),
    headerContent: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing(2),
      height: '100%',
      paddingLeft: theme.spacing(1),
    }),
    icon: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.h5.fontSize,
      lineHeight: 1,
    }),
    queryNameWrapper: css({
      display: 'flex',
      cursor: 'pointer',
      border: '1px solid transparent',
      borderRadius: theme.shape.radius.default,
      alignItems: 'center',
      padding: theme.spacing(0.5, 1),
      margin: 0,
      background: 'transparent',
      overflow: 'hidden',

      '&:hover': {
        background: theme.colors.action.hover,
        border: `1px dashed ${theme.colors.border.strong}`,
      },

      '&:focus': {
        border: `2px solid ${theme.colors.primary.border}`,
      },

      '&:hover, &:focus': {
        '.query-name-edit-icon': {
          visibility: 'visible',
        },
      },
    }),
    queryName: css({
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.primary.text,
      cursor: 'pointer',
      overflow: 'hidden',
      marginLeft: theme.spacing(0.5),
    }),
    queryEditIcon: cx(
      css({
        marginLeft: theme.spacing(1),
        visibility: 'hidden',
      }),
      'query-name-edit-icon'
    ),
    queryNameInput: css({
      maxWidth: '300px',
      margin: '-4px 0',
    }),
    transformName: css({
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      letterSpacing: '0.05em',
    }),
    debugWrapper: css({
      display: 'flex',
      flexDirection: 'row',
    }),
    debugSeparator: css({
      width: '48px',
      minHeight: '300px',
      display: 'flex',
      alignItems: 'center',
      alignSelf: 'stretch',
      justifyContent: 'center',
      margin: `0 ${theme.spacing(0.5)}`,
      color: theme.colors.primary.text,
    }),
    debugTitle: css({
      padding: `${theme.spacing(1)} ${theme.spacing(0.25)}`,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      flexGrow: 0,
      flexShrink: 1,
    }),
    debug: css({
      marginTop: theme.spacing(1),
      padding: `0 ${theme.spacing(1, 1, 1)}`,
      border: `1px solid ${theme.colors.border.weak}`,
      background: `${theme.isLight ? theme.v1.palette.white : theme.v1.palette.gray05}`,
      borderRadius: theme.shape.radius.default,
      width: '100%',
      minHeight: '300px',
      display: 'flex',
      flexDirection: 'column',
      alignSelf: 'stretch',
    }),
    debugJson: css({
      flexGrow: 1,
      height: '100%',
      overflow: 'hidden',
      padding: theme.spacing(0.5),
    }),
  };
};
