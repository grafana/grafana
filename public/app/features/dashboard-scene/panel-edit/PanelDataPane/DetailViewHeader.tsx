import { css, cx } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import {
  CoreApp,
  DataQuery,
  DataSourceInstanceSettings,
  GrafanaTheme2,
  standardTransformersRegistry,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import {
  Button,
  Dropdown,
  FieldValidationMessage,
  Icon,
  IconButton,
  Input,
  Menu,
  Stack,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { getQueryRunnerFor } from '../../utils/utils';

import { SavedQueriesDrawer } from './SavedQueriesDrawer';
import { QueryTransformItem } from './types';

interface DetailViewHeaderProps {
  selectedItem: QueryTransformItem;
  panel: VizPanel;
  onRemoveTransform?: (index: number) => void;
  onToggleTransformVisibility?: (index: number) => void;
}

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
});

export const DetailViewHeader = ({
  selectedItem,
  panel,
  onRemoveTransform,
  onToggleTransformVisibility,
}: DetailViewHeaderProps) => {
  const theme = useTheme2();
  const config = useMemo(() => ITEM_CONFIG(theme)[selectedItem.type], [theme, selectedItem.type]);
  const styles = useStyles2(getStyles, config);

  const [isEditing, setIsEditing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSavedQueriesDrawerOpen, setIsSavedQueriesDrawerOpen] = useState(false);

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

  // Handler for selecting a query from the library (replaces current query)
  const onSelectQueryFromLibrary = useCallback(
    (newQuery: DataQuery) => {
      if (selectedItem.type !== 'query' || selectedItem.index === undefined) {
        return;
      }
      updateQueries(
        (queries) =>
          queries.map((q, idx) =>
            idx === selectedItem.index ? { ...newQuery, refId: q.refId, datasource: q.datasource } : q
          ),
        true
      );
    },
    [selectedItem, updateQueries]
  );

  const refId = 'refId' in selectedItem.data ? selectedItem.data.refId : '';
  const isHidden =
    (selectedItem.type === 'query' || selectedItem.type === 'expression') &&
    'hide' in selectedItem.data &&
    selectedItem.data.hide;

  const isTransformDisabled =
    selectedItem.type === 'transform' && 'disabled' in selectedItem.data && selectedItem.data.disabled;

  // Get transformation display name
  const transformationName = useMemo(() => {
    if (selectedItem.type === 'transform' && 'id' in selectedItem.data) {
      const transformId = selectedItem.data.id;
      const transformer = standardTransformersRegistry.get(transformId);
      return transformer?.name || transformId;
    }
    return '';
  }, [selectedItem]);

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
            {selectedItem.type === 'query' && 'refId' in selectedItem.data && (
              <Button
                className={styles.monospace}
                variant="primary"
                fill="text"
                size="sm"
                icon="bookmark"
                onClick={() => setIsSavedQueriesDrawerOpen(true)}
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

      {/* Saved Queries Drawer */}
      {selectedItem.type === 'query' && 'refId' in selectedItem.data && (
        <SavedQueriesDrawer
          isOpen={isSavedQueriesDrawerOpen}
          onClose={() => setIsSavedQueriesDrawerOpen(false)}
          onSelectQuery={onSelectQueryFromLibrary}
          currentQuery={
            'datasource' in selectedItem.data
              ? {
                  refId: selectedItem.data.refId,
                  datasource: datasourceSettings
                    ? { uid: datasourceSettings.uid, type: datasourceSettings.type }
                    : selectedItem.data.datasource,
                }
              : { refId: selectedItem.data.refId }
          }
        />
      )}
    </div>
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
      minHeight: '41px',
    }),
    headerContent: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing(2),
      height: '100%',
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
      fontSize: theme.typography.body.fontSize,
    }),
  };
};
