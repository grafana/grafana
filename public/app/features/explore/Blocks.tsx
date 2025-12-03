import { css } from '@emotion/css';
import { createSelector } from '@reduxjs/toolkit';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  CoreApp,
  DataFrame,
  DataQuery,
  DataSourceInstanceSettings,
  EventBus,
  getDataSourceRef,
  getNextRefId,
  GrafanaTheme2,
  SplitOpen,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema/dist/esm/common/common.gen';
import { AdHocFilterItem, useStyles2, PanelContainer } from '@grafana/ui';

import { MIXED_DATASOURCE_NAME } from '../../plugins/datasource/mixed/MixedDataSource';
import { Block, ExploreItemState } from '../../types/explore';
import { useDispatch, useSelector } from '../../types/store';
import { getTimeSrv } from '../dashboard/services/TimeSrv';
import { getDatasourceSrv } from '../plugins/datasource_srv';
import { QueryEditorRow } from '../query/components/QueryEditorRow';

import { ContentOutlineItem } from './ContentOutline/ContentOutlineItem';
import { RenderResults } from './RenderResults';
import { changeDatasource } from './state/datasource';
import { changeQueries, runQueries, updateTextBlock } from './state/query';
import { getExploreItemSelector } from './state/selectors';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    queryContainer: css({
      label: 'queryContainer',
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
    }),
    textBlockArea: css({
      width: '100%',
      minHeight: theme.typography.bodySmall.lineHeight,
      border: 'none',
      background: 'transparent',
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
      fontFamily: theme.typography.body.fontFamily,
      resize: 'vertical',
      padding: 0,
      outline: 'none',
      overflow: 'hidden',
      '&:focus': {
        outline: 'none',
      },
      '::placeholder': {
        color: theme.colors.text.secondary,
      },
    }),
  };
};

type Props = {
  exploreId: string;
  changeCompactMode: (compact: boolean) => void;

  onSplitOpen: (panelType: string) => SplitOpen;
  onCellFilterAdded: (filter: AdHocFilterItem) => void;

  onClickFilterLabel: (key: string, value: string | number, frame?: DataFrame) => void;
  onClickFilterOutLabel: (key: string, value: string | number, frame?: DataFrame) => void;
  onClickFilterString: (value: string | number, refId?: string) => void;
  onClickFilterOutString: (value: string | number, refId?: string) => void;

  isFilterLabelActive: (key: string, value: string | number, refId?: string) => Promise<boolean>;

  onPinLineCallback: () => void;

  scrollElement: HTMLDivElement | undefined;

  graphEventBus: EventBus;
  logsEventBus: EventBus;
};

export function Blocks(props: Props) {
  const {
    exploreId,
    changeCompactMode,
    onSplitOpen,
    graphEventBus,
    logsEventBus,

    onCellFilterAdded,

    onClickFilterLabel,
    onClickFilterOutLabel,
    onClickFilterString,
    onClickFilterOutString,

    isFilterLabelActive,

    onPinLineCallback,

    scrollElement,
  } = props;

  const {
    getQueries,
    getDatasourceInstanceSettings,
    getQueryResponse,
    getHistory,
    getEventBridge,
    getQueryLibraryRef,
    getGraphResults,
    getBlocks,
  } = useMemo(() => makeSelectors(exploreId), [exploreId]);
  const styles = useStyles2(getStyles);

  const dsSettings = useSelector(getDatasourceInstanceSettings);
  const graphResult = useSelector(getGraphResults);
  const queries = useSelector(getQueries);
  const queryResponse = useSelector(getQueryResponse);
  const dispatch = useDispatch();
  const eventBridge = useSelector(getEventBridge);
  const queryLibraryRef = useSelector(getQueryLibraryRef);
  const history = useSelector(getHistory);
  const blocks = useSelector(getBlocks);

  const onChange = useCallback(
    (newQueries: DataQuery[], options?: { skipAutoImport?: boolean }) => {
      dispatch(changeQueries({ exploreId, queries: newQueries, options }));
    },
    [dispatch, exploreId]
  );

  const onUpdateDatasources = useCallback(
    (datasource: DataSourceRef) => {
      dispatch(changeDatasource({ exploreId, datasource }));
    },
    [dispatch, exploreId]
  );

  const onAddQuery = useCallback(
    (query: DataQuery) => {
      onChange([...queries, { ...query, refId: getNextRefId(queries) }]);
    },
    [onChange, queries]
  );

  const onRunQueries = useCallback(() => {
    dispatch(runQueries({ exploreId }));
  }, [dispatch, exploreId]);

  const onQueryCopied = () => {
    reportInteraction('grafana_explore_query_row_copy');
  };

  const onQueryReplacedFromLibrary = () => {
    reportInteraction('grafana_explore_query_replaced_from_library');
  };

  const onQueryRemoved = () => {
    reportInteraction('grafana_explore_query_row_remove');
  };

  const onQueryToggled = (queryStatus?: boolean) => {
    reportInteraction('grafana_query_row_toggle', queryStatus === undefined ? {} : { queryEnabled: queryStatus });
  };

  const onQueryOpenChanged = () => {
    // Disables compact mode when query is opened.
    // Compact mode can also be disabled by opening Content Outline.
    changeCompactMode(false);
  };

  const onRemoveQuery = (query: DataQuery) => {
    onChange(queries.filter((item) => item !== query));
  };

  const onChangeQuery = (query: DataQuery, index: number) => {
    // update query in array
    onChange(
      queries.map((item, itemIndex) => {
        if (itemIndex === index) {
          return query;
        }
        return item;
      })
    );
  };

  const onReplaceQuery = (query: DataQuery, index: number) => {
    // Replace old query with new query, preserving the original refId
    const newQueries = queries.map((item, itemIndex) => {
      if (itemIndex === index) {
        return { ...query, refId: item.refId };
      }
      return item;
    });
    onChange(newQueries, { skipAutoImport: true });

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
  };

  const onDataSourceChange = (dataSource: DataSourceInstanceSettings, index: number) => {
    Promise.all(
      queries.map(async (item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const dataSourceRef = getDataSourceRef(dataSource);

        if (item.datasource) {
          const previous = getDataSourceSrv().getInstanceSettings(item.datasource);

          if (previous?.type === dataSource.type) {
            return {
              ...item,
              datasource: dataSourceRef,
            };
          }
        }

        const ds = await getDataSourceSrv().get(dataSourceRef);

        return { ...ds.getDefaultQuery?.(CoreApp.PanelEditor), ...item, datasource: dataSourceRef };
      })
    ).then(
      (values) => onChange(values),
      () => {
        throw new Error(`Failed to get datasource ${dataSource.name ?? dataSource.uid}`);
      }
    );
  };

  const handleTextBlockChange = useCallback(
    (index: number, text: string) => {
      dispatch(updateTextBlock(exploreId, index, text));
    },
    [dispatch, exploreId]
  );

  return blocks.map((block, index) => {
    if (block.type === 'query') {
      const query = queries.find((query) => query.refId === block.queryRef);
      if (!query) {
        return null;
      }
      const dataSourceSettings = getDataSourceSettings(query, dsSettings);
      const onChangeDataSourceSettings = dsSettings.meta.mixed
        ? (settings: DataSourceInstanceSettings) => onDataSourceChange(settings, index)
        : undefined;

      const queryEditorRow = (
        <QueryEditorRow
          id={query.refId}
          index={index}
          key={query.refId}
          data={queryResponse}
          query={query}
          dataSource={dataSourceSettings}
          onChangeDataSource={onChangeDataSourceSettings}
          onChange={(query) => onChangeQuery(query, index)}
          onReplace={(query) => onReplaceQuery(query, index)}
          onRemoveQuery={onRemoveQuery}
          onAddQuery={onAddQuery}
          onRunQuery={onRunQueries}
          onQueryCopied={onQueryCopied}
          onQueryRemoved={onQueryRemoved}
          onQueryToggled={onQueryToggled}
          onQueryOpenChanged={onQueryOpenChanged}
          onQueryReplacedFromLibrary={onQueryReplacedFromLibrary}
          queries={queries}
          app={CoreApp.Explore}
          range={getTimeSrv().timeRange()}
          history={history}
          eventBus={eventBridge}
          queryLibraryRef={queryLibraryRef}
          onCancelQueryLibraryEdit={() => {}}
          isOpen={true}
        />
      );

      const queryTitle = t('explore.blocks.query-block.title', 'Query {{refId}}', {
        refId: query.refId,
      });

      return (
        <ContentOutlineItem
          title={queryTitle}
          icon="arrow"
          key={`query-${query.refId}`}
          panelId={`query-${query.refId}`}
        >
          <PanelContainer className={styles.queryContainer}>
            {queryEditorRow}

            <RenderResults
              exploreId={exploreId}
              queryRef={query.refId}
              graphResult={graphResult}
              onSplitOpen={onSplitOpen}
              graphEventBus={graphEventBus}
              logsEventBus={logsEventBus}
              eventBus={eventBridge}
              onCellFilterAdded={onCellFilterAdded}
              onClickFilterLabel={onClickFilterLabel}
              onClickFilterOutLabel={onClickFilterOutLabel}
              onClickFilterString={onClickFilterString}
              onClickFilterOutString={onClickFilterOutString}
              isFilterLabelActive={isFilterLabelActive}
              onPinLineCallback={onPinLineCallback}
              scrollElement={scrollElement}
            />
          </PanelContainer>
        </ContentOutlineItem>
      );
    }

    if (block.type === 'text') {
      const icon = 'paragraph';
      const firstWord = block.text.trim().split(/\s+/)[0] ?? '';
      const title = firstWord
        ? t('explore.blocks.text-block.title', 'Text "{{word}}"', { word: firstWord })
        : t('explore.blocks.text-block.empty', 'Text block');
      return (
        <ContentOutlineItem title={title} icon={icon} key={`${block.type}-${index}`} panelId={`${block.type}-${index}`}>
          <PanelContainer className={styles.queryContainer}>
            <TextBlockEditor
              value={block.text}
              onChange={(value) => handleTextBlockChange(index, value)}
              placeholder={t('explore.blocks.text-block.placeholder', 'Enter text')}
              className={styles.textBlockArea}
            />
          </PanelContainer>
        </ContentOutlineItem>
      );
    }

    if (block.type === 'expression') {
      const title = t('explore.blocks.expression-block.title', 'Expression block');
      const icon = 'magic';
      return (
        <ContentOutlineItem title={title} icon={icon} key={`expression-${index}`} panelId={`expression-${index}`}>
          <PanelContainer className={styles.queryContainer}>
            {t('explore.blocks.expression-block.placeholder', 'Expression blocks are coming soon.')}
          </PanelContainer>
        </ContentOutlineItem>
      );
    }

    return null;
  });
}

function TextBlockEditor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      className={className}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder={placeholder}
    />
  );
}

const getDataSourceSettings = (
  query: DataQuery,
  groupSettings: DataSourceInstanceSettings
): DataSourceInstanceSettings => {
  if (!query.datasource) {
    return groupSettings;
  }
  const querySettings = getDataSourceSrv().getInstanceSettings(query.datasource);
  return querySettings || groupSettings;
};

const makeSelectors = (exploreId: string) => {
  const exploreItemSelector = getExploreItemSelector(exploreId);
  return {
    getQueries: createSelector(exploreItemSelector, (s: ExploreItemState | undefined) => s!.queries),
    getQueryResponse: createSelector(exploreItemSelector, (s: ExploreItemState | undefined) => s!.queryResponse),
    getHistory: createSelector(exploreItemSelector, (s: ExploreItemState | undefined) => s!.history),
    getEventBridge: createSelector(exploreItemSelector, (s: ExploreItemState | undefined) => s!.eventBridge),
    getDatasourceInstanceSettings: createSelector(
      exploreItemSelector,
      (s: ExploreItemState | undefined) => getDatasourceSrv().getInstanceSettings(s!.datasourceInstance?.uid)!
    ),
    getQueryLibraryRef: createSelector(exploreItemSelector, (s) => s!.queryLibraryRef),
    getGraphResults: createSelector(exploreItemSelector, (s) => s!.graphResult),
    getBlocks: createSelector(exploreItemSelector, (s: ExploreItemState | undefined) => {
      if (!s) {
        return [];
      }

      if (s.blocks?.length) {
        return s.blocks;
      }

      const fallbackBlocks: Block[] = s.queries
        .filter((query) => Boolean(query.refId))
        .map((query) => ({ type: 'query' as const, queryRef: query.refId! }));

      return fallbackBlocks;
    }),
  };
};
