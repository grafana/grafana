import { css } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import { startTransition, useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { DataFrame, fuzzySearch, GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { getDragStyles, IconButton, useStyles2 } from '@grafana/ui';
import { FieldNameMetaStore } from 'app/features/explore/Logs/LogsTableWrap';
import { SETTING_KEY_ROOT } from 'app/features/explore/Logs/utils/logs';
import { parseLogsFrame } from 'app/features/logs/logsFrame';

import { LOG_LINE_BODY_FIELD_NAME } from '../../LogDetailsBody';
import { getSuggestedFieldsForLogs } from '../../otel/formats';
import { useLogListContext } from '../LogListContext';
import { reportInteractionOnce } from '../analytics';
import { LogListModel } from '../processing';

import { FieldList } from './FieldList';
import { FieldSearch } from './FieldSearch';

/**
 * FieldSelector wrapper for the LogList visualization.
 */
interface LogListFieldSelectorProps {
  containerElement: HTMLDivElement;
  logs: LogListModel[];
  dataFrames: DataFrame[];
}

const DEFAULT_WIDTH = 220;
export const MIN_WIDTH = 20;

export const LogListFieldSelector = ({ containerElement, dataFrames, logs }: LogListFieldSelectorProps) => {
  const { displayedFields, onClickShowField, onClickHideField, setDisplayedFields, logOptionsStorageKey } =
    useLogListContext();
  const [sidebarHeight, setSidebarHeight] = useState(220);
  const [sidebarWidth, setSidebarWidth] = useState(getSidebarWidth(logOptionsStorageKey));
  const dragStyles = useStyles2(getDragStyles);

  useLayoutEffect(() => {
    const observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      if (entries.length) {
        setSidebarHeight(entries[0].contentRect.height);
      }
    });
    observer.observe(containerElement);
    return () => observer.disconnect();
  }, [containerElement]);

  const setSidebarWidthWrapper = useCallback(
    (width: number) => {
      setSidebarWidth(width);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.fieldSelector.width`, width);
      }
    },
    [logOptionsStorageKey]
  );

  const clearFields = useCallback(() => {
    setDisplayedFields?.([]);
  }, [setDisplayedFields]);

  const collapse = useCallback(() => {
    setSidebarWidthWrapper(MIN_WIDTH);
  }, [setSidebarWidthWrapper]);

  const expand = useCallback(() => {
    const width = getSidebarWidth(logOptionsStorageKey);
    setSidebarWidthWrapper(width < 2 * MIN_WIDTH ? DEFAULT_WIDTH : width);
  }, [logOptionsStorageKey, setSidebarWidthWrapper]);

  const handleResize: ResizeCallback = useCallback(
    (event, direction, ref) => {
      setSidebarWidthWrapper(ref.clientWidth);
    },
    [setSidebarWidthWrapper]
  );

  const toggleField = useCallback(
    (name: string) => {
      if (displayedFields.includes(name)) {
        onClickHideField?.(name);
      } else {
        onClickShowField?.(name);
      }
    },
    [displayedFields, onClickHideField, onClickShowField]
  );

  const suggestedFields = useMemo(() => getSuggestedFields(logs, displayedFields), [displayedFields, logs]);
  const fields = useMemo(() => getFieldsWithStats(dataFrames), [dataFrames]);

  if (!onClickShowField || !onClickHideField || !setDisplayedFields) {
    console.warn('Missing required props: onClickShowField, onClickHideField, setDisplayedFields');
    return null;
  }
  if (sidebarHeight === 0) {
    return null;
  }

  return (
    <Resizable
      enable={{
        right: true,
      }}
      handleClasses={{ right: dragStyles.dragHandleVertical }}
      size={{ width: sidebarWidth, height: sidebarHeight }}
      defaultSize={{ width: sidebarWidth, height: sidebarHeight }}
      minWidth={MIN_WIDTH}
      maxWidth={containerElement.clientWidth * 0.8}
      onResize={handleResize}
    >
      {sidebarWidth > MIN_WIDTH * 2 ? (
        <FieldSelector
          activeFields={displayedFields}
          clear={clearFields}
          collapse={collapse}
          fields={fields}
          reorder={setDisplayedFields}
          suggestedFields={suggestedFields}
          toggle={toggleField}
        />
      ) : (
        <div className={logsFieldSelectorWrapperStyles.collapsedButtonContainer}>
          <IconButton
            className={logsFieldSelectorWrapperStyles.collapsedButton}
            onClick={expand}
            name="arrow-from-right"
            tooltip={t('logs.field-selector.expand', 'Expand sidebar')}
            size="sm"
          />
        </div>
      )}
    </Resizable>
  );
};

const logsFieldSelectorWrapperStyles = {
  collapsedButtonContainer: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 2,
  }),
  collapsedButton: css({
    margin: 0,
  }),
};

/**
 * FieldSelector wrapper for the LogsTable visualization.
 */
interface LogsTableFieldSelectorProps {
  columnsWithMeta: FieldNameMetaStore;
  clear(): void;
  dataFrames: DataFrame[];
  logs: LogListModel[];
  reorder(columns: string[]): void;
  setSidebarWidth(width: number): void;
  sidebarWidth: number;
  toggle(key: string): void;
}

export const LogsTableFieldSelector = ({
  columnsWithMeta,
  clear,
  dataFrames,
  logs,
  reorder,
  setSidebarWidth,
  sidebarWidth,
  toggle,
}: LogsTableFieldSelectorProps) => {
  const setSidebarWidthWrapper = useCallback(
    (width: number) => {
      setSidebarWidth(width);
      store.set(`${SETTING_KEY_ROOT}.fieldSelector.width`, width);
    },
    [setSidebarWidth]
  );

  const collapse = useCallback(() => {
    setSidebarWidthWrapper(MIN_WIDTH);
  }, [setSidebarWidthWrapper]);

  const expand = useCallback(() => {
    const width = getSidebarWidth(SETTING_KEY_ROOT);
    setSidebarWidthWrapper(width < 2 * MIN_WIDTH ? DEFAULT_WIDTH : width);
  }, [setSidebarWidthWrapper]);

  const displayedColumns = useMemo(
    () =>
      Object.keys(columnsWithMeta)
        .filter((column) => columnsWithMeta[column].active)
        .sort((a, b) =>
          columnsWithMeta[a].index !== undefined && columnsWithMeta[b].index !== undefined
            ? columnsWithMeta[a].index - columnsWithMeta[b].index
            : 0
        ),
    [columnsWithMeta]
  );

  const defaultColumns = useMemo(
    () =>
      Object.keys(columnsWithMeta)
        .sort((a, b) =>
          columnsWithMeta[a].index !== undefined && columnsWithMeta[b].index !== undefined
            ? columnsWithMeta[a].index - columnsWithMeta[b].index
            : 0
        )
        .filter(
          (column) => columnsWithMeta[column].type === 'TIME_FIELD' || columnsWithMeta[column].type === 'BODY_FIELD'
        ),
    [columnsWithMeta]
  );

  const suggestedFields = useMemo(
    () => getSuggestedFields(logs, displayedColumns, defaultColumns),
    [defaultColumns, displayedColumns, logs]
  );
  const fields = useMemo(() => getFieldsWithStats(dataFrames), [dataFrames]);

  return sidebarWidth > MIN_WIDTH * 2 ? (
    <FieldSelector
      activeFields={displayedColumns}
      clear={clear}
      collapse={collapse}
      fields={fields}
      reorder={reorder}
      suggestedFields={suggestedFields}
      toggle={toggle}
    />
  ) : (
    <div className={logsFieldSelectorWrapperStyles.collapsedButtonContainer}>
      <IconButton
        className={logsFieldSelectorWrapperStyles.collapsedButton}
        onClick={expand}
        name="arrow-from-right"
        tooltip={t('logs.field-selector.expand', 'Expand sidebar')}
        size="sm"
      />
    </div>
  );
};

interface FieldStats {
  percentOfLinesWithLabel: number;
}

export interface FieldWithStats {
  name: string;
  stats: FieldStats;
}

export interface FieldSelectorProps {
  activeFields: string[];
  clear(): void;
  collapse(): void;
  fields: FieldWithStats[];
  reorder(fields: string[]): void;
  suggestedFields: FieldWithStats[];
  toggle: (key: string) => void;
}

export const FieldSelector = ({
  activeFields,
  clear,
  collapse,
  fields,
  reorder,
  suggestedFields,
  toggle,
}: FieldSelectorProps) => {
  const [searchValue, setSearchValue] = useState<string>('');
  const styles = useStyles2(getStyles);

  const onSearchInputChange = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    startTransition(() => {
      setSearchValue(e.currentTarget.value);
    });
    reportInteractionOnce('grafana_explore_logs_table_text_search');
  }, []);

  const filteredFields = useMemo(() => {
    if (!searchValue) {
      return fields;
    }
    const idxs = fuzzySearch(
      fields.map((field) => field.name),
      searchValue
    );
    return fields.filter((_, index) => idxs.includes(index));
  }, [fields, searchValue]);

  const filteredSuggestedFields = useMemo(() => {
    if (!searchValue) {
      return suggestedFields;
    }
    const idxs = fuzzySearch(
      suggestedFields.map((field) => field.name),
      searchValue
    );
    return suggestedFields.filter((_, index) => idxs.includes(index));
  }, [searchValue, suggestedFields]);

  return (
    <section className={styles.sidebar}>
      <FieldSearch collapse={collapse} onChange={onSearchInputChange} value={searchValue} />
      <FieldList
        activeFields={activeFields}
        clear={clear}
        fields={filteredFields}
        reorder={reorder}
        suggestedFields={filteredSuggestedFields}
        toggle={toggle}
      />
    </section>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    sidebar: css({
      fontSize: theme.typography.pxToRem(11),
      paddingRight: theme.spacing(3),
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }),
  };
}

function getFieldsWithStats(dataFrames: DataFrame[]): FieldWithStats[] {
  const cardinality = new Map<string, number>();
  let totalLines = 0;
  const allFields = dataFrames.flatMap((dataFrame) => {
    const logsFrame = parseLogsFrame(dataFrame);
    totalLines += dataFrame.length;

    const labelValues = logsFrame?.getLogFrameLabelsAsLabels();
    const labels =
      labelValues?.flatMap((labels) => {
        const keys = Object.keys(labels);
        keys.map((key) => cardinality.set(key, (cardinality.get(key) ?? 0) + 1));
        return keys;
      }) ?? [];

    const fields = (logsFrame?.extraFields ?? [])
      .filter((field) => !field?.config?.custom?.hidden)
      .map((field) => {
        cardinality.set(field.name, field.values.filter((value) => value !== null && value !== undefined).length);
        return field.name;
      });

    return [...labels, ...fields];
  });

  const labels = [...new Set(allFields)];

  return labels.map((label) => ({
    name: label,
    stats: {
      percentOfLinesWithLabel: Math.ceil((100 * (cardinality.get(label) ?? 0)) / totalLines),
    },
  }));
}

function getSuggestedFields(logs: LogListModel[], displayedFields: string[], defaultFields: string[] = []) {
  const suggestedFields: FieldWithStats[] = defaultFields.map((field) => ({
    name: field,
    stats: {
      percentOfLinesWithLabel: 100,
    },
  }));
  if (config.featureToggles.otelLogsFormatting) {
    getSuggestedFieldsForLogs(logs).forEach((field) => {
      suggestedFields.push({
        name: field,
        stats: {
          percentOfLinesWithLabel: 100,
        },
      });
    });
  }

  if (
    !defaultFields.length &&
    displayedFields.length &&
    !suggestedFields.find((field) => field.name === LOG_LINE_BODY_FIELD_NAME)
  ) {
    suggestedFields.push({
      name: LOG_LINE_BODY_FIELD_NAME,
      stats: {
        percentOfLinesWithLabel: 100,
      },
    });
  }

  return suggestedFields;
}

export function getSidebarWidth(logOptionsStorageKey?: string): number {
  const width =
    (logOptionsStorageKey
      ? parseInt(store.get(`${logOptionsStorageKey}.fieldSelector.width`) ?? DEFAULT_WIDTH, 10)
      : undefined) ?? DEFAULT_WIDTH;

  return width < MIN_WIDTH ? MIN_WIDTH : width;
}
