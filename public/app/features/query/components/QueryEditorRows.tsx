import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';
import { PureComponent, type ComponentProps, type ReactNode } from 'react';
import { useAsync } from 'react-use';

import {
  CoreApp,
  type DataQuery,
  type DataSourceInstanceSettings,
  type EventBusExtended,
  type HistoryItem,
  type PanelData,
  type ScopedVars,
  getDataSourceRef,
  getNextRefId,
  isSystemOverrideWithRef,
} from '@grafana/data';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { SafeSerializableSceneObject, type SceneObjectRef, type VizPanel } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { trackReorder } from 'app/features/dashboard-scene/panel-edit/PanelEditNext/tracking';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { QueryEditorRow } from './QueryEditorRow';
import { getQueryDataSourceIdentity } from './queryDataSourceIdentity';

export interface Props {
  // The query configuration
  queries: DataQuery[];
  dsSettings: DataSourceInstanceSettings;

  // Query editing
  onQueriesChange: (queries: DataQuery[], options?: { skipAutoImport?: boolean }) => void;
  onAddQuery: (query: DataQuery) => void;
  onRunQueries: () => void;

  // Query Response Data
  data: PanelData;

  // Misc
  app?: CoreApp;
  history?: Array<HistoryItem<DataQuery>>;
  eventBus?: EventBusExtended;
  onQueryCopied?: () => void;
  onQueryRemoved?: () => void;
  onQueryToggled?: (queryStatus?: boolean | undefined) => void;
  onQueryOpenChanged?: (status?: boolean | undefined) => void;
  onUpdateDatasources?: (datasource: DataSourceRef) => void;
  onQueryReplacedFromLibrary?: () => void;
  queryRowWrapper?: (children: ReactNode, refId: string) => ReactNode;
  editSavedQueryRef?: string;
  onExitQueryLibraryEdit?: () => void;
  addingSavedQuery?: boolean;
  onCancelAddSavedQuery?: () => void;
  isOpen?: boolean;
  panelRef?: SceneObjectRef<VizPanel>;
  /** refId of a row to scroll into view once it renders (e.g. a freshly added query). */
  scrollToRefId?: string;
  /** Called after the row identified by scrollToRefId has been scrolled into view. */
  onScrollIntoView?: () => void;
}

export class QueryEditorRows extends PureComponent<Props> {
  onRemoveQuery = (query: DataQuery) => {
    this.props.onQueriesChange(this.props.queries.filter((item) => item !== query));
  };

  onChangeQuery(query: DataQuery, index: number) {
    const { queries, onQueriesChange } = this.props;

    // update query in array
    onQueriesChange(
      queries.map((item, itemIndex) => {
        if (itemIndex === index) {
          return query;
        }
        return item;
      })
    );

    if (this.props.panelRef) {
      const panel = this.props.panelRef.resolve();
      const hideSeriesOverrideIndex = panel.state.fieldConfig.overrides.findIndex(
        isSystemOverrideWithRef('hideSeriesFrom')
      );

      if (hideSeriesOverrideIndex !== -1) {
        const newOverrides = [...panel.state.fieldConfig.overrides];
        newOverrides.splice(hideSeriesOverrideIndex, 1);

        panel.setState({ fieldConfig: { ...panel.state.fieldConfig, overrides: newOverrides } });
      }
    }
  }

  onReplaceQuery(query: DataQuery, index: number) {
    const { queries, onQueriesChange, onUpdateDatasources, dsSettings, onRunQueries } = this.props;

    // Replace old query with new query, preserving the original refId
    const newQueries = queries.map((item, itemIndex) => {
      if (itemIndex === index) {
        return { ...query, refId: item.refId };
      }
      return item;
    });
    onQueriesChange(newQueries, { skipAutoImport: true });

    // Update datasources based on the new query set
    if (query.datasource?.uid) {
      const uniqueDatasources = new Set(newQueries.map((q) => q.datasource?.uid));
      const isMixed = uniqueDatasources.size > 1;
      const newDatasourceRef = {
        uid: isMixed ? MIXED_DATASOURCE_NAME : query.datasource.uid,
      };
      const shouldChangeDatasource = dsSettings.uid !== newDatasourceRef.uid;
      if (shouldChangeDatasource) {
        onUpdateDatasources?.(newDatasourceRef);
      }
    }

    onRunQueries();
  }

  // Replace the query at `index` with several queries (e.g. selecting a recent entry that ran
  // multiple queries together). The first replacement keeps the original refId; the rest get
  // fresh refIds computed against the growing set so they don't collide.
  onReplaceQueries(replacementQueries: DataQuery[], index: number) {
    const { queries, onQueriesChange, onUpdateDatasources, dsSettings, onRunQueries } = this.props;

    if (replacementQueries.length === 0) {
      return;
    }

    const originalRefId = queries[index]?.refId;
    const newQueries = [...queries];
    const replacements: DataQuery[] = [];
    replacementQueries.forEach((replacement, replacementIndex) => {
      if (replacementIndex === 0) {
        replacements.push({ ...replacement, refId: originalRefId ?? replacement.refId });
      } else {
        // Exclude the slot being replaced when picking the next refId, plus the ones we've staged.
        const taken = [...newQueries.filter((_, i) => i !== index), ...replacements];
        replacements.push({ ...replacement, refId: getNextRefId(taken) });
      }
    });
    newQueries.splice(index, 1, ...replacements);
    onQueriesChange(newQueries, { skipAutoImport: true });

    // Update datasources based on the new query set
    const replacementDatasourceUid = replacementQueries.find((q) => q.datasource?.uid)?.datasource?.uid;
    if (replacementDatasourceUid) {
      const uniqueDatasources = new Set(newQueries.map((q) => q.datasource?.uid));
      const isMixed = uniqueDatasources.size > 1;
      const newDatasourceRef = {
        uid: isMixed ? MIXED_DATASOURCE_NAME : replacementDatasourceUid,
      };
      const shouldChangeDatasource = dsSettings.uid !== newDatasourceRef.uid;
      if (shouldChangeDatasource) {
        onUpdateDatasources?.(newDatasourceRef);
      }
    }

    onRunQueries();
  }

  onDataSourceChange(dataSource: DataSourceInstanceSettings, index: number) {
    const { queries, onQueriesChange } = this.props;

    Promise.all(
      queries.map(async (item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const dataSourceRef = getDataSourceRef(dataSource);

        if (item.datasource) {
          const previous = await getDataSourceInstanceSettings(item.datasource);

          if (previous?.type === dataSource.type) {
            return {
              ...item,
              datasource: dataSourceRef,
            };
          }
        }

        const ds = await getDataSourceInstance(dataSourceRef);

        return { ...ds.getDefaultQuery?.(CoreApp.PanelEditor), ...item, datasource: dataSourceRef };
      })
    ).then(
      (values) => onQueriesChange(values),
      () => {
        throw new Error(`Failed to get datasource ${dataSource.name ?? dataSource.uid}`);
      }
    );
  }

  onDragEnd = (result: DropResult) => {
    const { queries, onQueriesChange } = this.props;

    if (!result || !result.destination) {
      return;
    }

    const startIndex = result.source.index;
    const endIndex = result.destination.index;

    if (startIndex === endIndex) {
      return;
    }

    const update = Array.from(queries);
    const [removed] = update.splice(startIndex, 1);
    update.splice(endIndex, 0, removed);
    onQueriesChange(update);

    trackReorder('query', { silent: true });
  };

  render() {
    const {
      dsSettings,
      data,
      queries,
      app,
      history,
      eventBus,
      onAddQuery,
      onRunQueries,
      onQueryCopied,
      onQueryRemoved,
      onQueryToggled,
      onQueryOpenChanged,
      onQueryReplacedFromLibrary,
      queryRowWrapper,
      editSavedQueryRef,
      onExitQueryLibraryEdit,
      addingSavedQuery,
      onCancelAddSavedQuery,
      isOpen,
      panelRef,
      scrollToRefId,
      onScrollIntoView,
    } = this.props;

    // Scene scope for resolving section-scoped (row/tab) datasource variables, which live on a
    // layout node rather than the dashboard root and so are not reachable from the global scene context.
    const scopedVars: ScopedVars | undefined = panelRef
      ? { __sceneObject: new SafeSerializableSceneObject(panelRef.resolve()) }
      : undefined;

    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="transformations-list" direction="vertical">
          {(provided) => {
            return (
              <div data-testid="query-editor-rows" ref={provided.innerRef} {...provided.droppableProps}>
                {queries.map((query, index) => {
                  const onChangeDataSourceSettings = dsSettings.meta.mixed
                    ? (settings: DataSourceInstanceSettings) => this.onDataSourceChange(settings, index)
                    : undefined;

                  const queryEditorRow = (
                    <QueryEditorRowWithResolvedDataSource
                      id={query.refId}
                      index={index}
                      key={query.refId}
                      data={data}
                      query={query}
                      groupSettings={dsSettings}
                      scopedVars={scopedVars}
                      onChangeDataSource={onChangeDataSourceSettings}
                      onChange={(query) => this.onChangeQuery(query, index)}
                      onReplace={(query) => this.onReplaceQuery(query, index)}
                      onReplaceQueries={(queries) => this.onReplaceQueries(queries, index)}
                      onRemoveQuery={this.onRemoveQuery}
                      onAddQuery={onAddQuery}
                      onRunQuery={onRunQueries}
                      onQueryCopied={onQueryCopied}
                      onQueryRemoved={onQueryRemoved}
                      onQueryToggled={onQueryToggled}
                      onQueryOpenChanged={onQueryOpenChanged}
                      onQueryReplacedFromLibrary={onQueryReplacedFromLibrary}
                      queries={queries}
                      app={app}
                      range={getTimeSrv().timeRange()}
                      history={history}
                      eventBus={eventBus}
                      editSavedQueryRef={editSavedQueryRef}
                      onExitQueryLibraryEdit={onExitQueryLibraryEdit}
                      addingSavedQuery={addingSavedQuery}
                      onCancelAddSavedQuery={onCancelAddSavedQuery}
                      isOpen={isOpen}
                      scrollIntoView={scrollToRefId !== undefined && query.refId === scrollToRefId}
                      onScrollIntoView={onScrollIntoView}
                    />
                  );

                  return queryRowWrapper ? queryRowWrapper(queryEditorRow, query.refId) : queryEditorRow;
                })}
                {provided.placeholder}
              </div>
            );
          }}
        </Droppable>
      </DragDropContext>
    );
  }
}

type QueryEditorRowWithResolvedDataSourceProps = Omit<
  ComponentProps<typeof QueryEditorRow>,
  'dataSource' | 'query' | 'scopedVars'
> & {
  query: DataQuery;
  groupSettings: DataSourceInstanceSettings;
  scopedVars?: ScopedVars;
};

function QueryEditorRowWithResolvedDataSource({
  query,
  groupSettings,
  scopedVars,
  ...rowProps
}: QueryEditorRowWithResolvedDataSourceProps) {
  // Compare by value: `scopedVars` is a new `{ __sceneObject }` wrapper on every
  // QueryEditorRows render, and `query.datasource` is often an inline object.
  // `interpolatedUid` is required too — `${ds}` and the scene key stay the same when
  // the variable's value changes, but instance settings (type, meta, jsonData) do not.
  const interpolatedUid = getQueryDataSourceIdentity(query.datasource, scopedVars);
  const datasourceKey = stableKey(query.datasource);
  const varsKey = scopedVarsKey(scopedVars);
  // Stamp the interpolated identity onto the fetch so a variable change cannot reuse
  // the previous settings for one render (`useAsync` keeps the old value until the
  // effect runs). Comparing settings fields is not enough: interpolation can yield a
  // datasource name while `rawRef` stores the concrete uid.
  const { value } = useAsync(
    async () => {
      if (!query.datasource) {
        return undefined;
      }
      const settings = await getDataSourceInstanceSettings(query.datasource, scopedVars);
      return { settings, interpolatedUid };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datasourceKey, varsKey, interpolatedUid]
  );

  const fetchMatches = Boolean(value && value.interpolatedUid === interpolatedUid);
  const currentQuerySettings = fetchMatches ? value?.settings : undefined;
  const dataSourceSettings = resolveRowDataSourceSettings(query.datasource, currentQuerySettings, groupSettings, {
    lookupFailed: fetchMatches && currentQuerySettings === undefined,
  });

  // Always render the row so `@hello-pangea/dnd` indices stay contiguous. Returning null
  // here skips a Draggable and also hides deleted-datasource queries with no recovery path.
  return <QueryEditorRow {...rowProps} query={query} dataSource={dataSourceSettings} scopedVars={scopedVars} />;
}

export function resolveRowDataSourceSettings(
  queryDatasource: DataQuery['datasource'],
  querySettings: DataSourceInstanceSettings | undefined,
  groupSettings: DataSourceInstanceSettings,
  options?: { lookupFailed?: boolean }
): DataSourceInstanceSettings {
  if (!queryDatasource) {
    return groupSettings;
  }
  if (querySettings) {
    return querySettings;
  }
  if (!groupSettings.meta.mixed) {
    return groupSettings;
  }
  if (isMixedQueryDatasource(queryDatasource, groupSettings) || !queryDatasourceUid(queryDatasource)) {
    return groupSettings;
  }
  if (!options?.lookupFailed) {
    return groupSettings;
  }
  // An interpolated uid that still contains `$` is "can't tell yet", not "definitely missing".
  if (queryDatasourceUid(queryDatasource)?.includes('$')) {
    return groupSettings;
  }
  return notFoundSettings(queryDatasource, groupSettings);
}

function queryDatasourceUid(queryDatasource: DataQuery['datasource'] | string): string | undefined {
  return typeof queryDatasource === 'string' ? queryDatasource : queryDatasource?.uid;
}

function isMixedQueryDatasource(
  queryDatasource: DataQuery['datasource'] | string,
  groupSettings: DataSourceInstanceSettings
): boolean {
  const uid = queryDatasourceUid(queryDatasource);
  if (uid && (uid === MIXED_DATASOURCE_NAME || uid === groupSettings.uid)) {
    return true;
  }
  const type = typeof queryDatasource === 'string' ? undefined : queryDatasource?.type;
  return type === 'mixed';
}

/**
 * Stand-in settings for a mixed-panel query whose datasource could not be resolved.
 * Name is the raw uid — `DataSourcePicker` already labels an unresolvable current
 * ref as `<uid> - not found`, so we must not append that suffix here.
 */
function notFoundSettings(
  queryDatasource: DataQuery['datasource'],
  groupSettings: DataSourceInstanceSettings
): DataSourceInstanceSettings {
  const uid = typeof queryDatasource === 'string' ? queryDatasource : (queryDatasource?.uid ?? '');
  const type = typeof queryDatasource === 'string' ? undefined : queryDatasource?.type;

  return {
    ...groupSettings,
    uid,
    name: uid,
    type: type || groupSettings.type,
    meta: {
      ...groupSettings.meta,
      mixed: false,
    },
    rawRef: undefined,
  };
}

function stableKey(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function scopedVarsKey(scopedVars?: ScopedVars): string {
  if (!scopedVars) {
    return '';
  }

  const sceneVar = scopedVars.__sceneObject;
  if (!sceneVar) {
    return stableKey(scopedVars);
  }

  // SafeSerializableSceneObject is circular under JSON.stringify (`value` returns this).
  // Key by the underlying scene object so a new wrapper each render does not refetch.
  const sceneObject = typeof sceneVar.valueOf === 'function' ? sceneVar.valueOf() : sceneVar;
  const key = sceneObjectKey(sceneObject);
  return key != null ? `scene:${key}` : 'scene';
}

function sceneObjectKey(sceneObject: unknown): string | undefined {
  if (sceneObject == null || typeof sceneObject !== 'object' || !('state' in sceneObject)) {
    return undefined;
  }

  const state = sceneObject.state;
  if (state == null || typeof state !== 'object' || !('key' in state) || state.key == null) {
    return undefined;
  }

  return String(state.key);
}
