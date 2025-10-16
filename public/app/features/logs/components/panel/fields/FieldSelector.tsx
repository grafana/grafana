import { css } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import { startTransition, useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { DataFrame, fuzzySearch, GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { getDragStyles, IconButton, useStyles2 } from '@grafana/ui';
import { parseLogsFrame } from 'app/features/logs/logsFrame';

import { LOG_LINE_BODY_FIELD_NAME } from '../../LogDetailsBody';
import { getDisplayedFieldsForLogs } from '../../otel/formats';
import { useLogListContext } from '../LogListContext';
import { LogListModel } from '../processing';

import { FieldList } from './FieldList';
import { FieldSearch } from './FieldSearch';

interface LogListFieldSelectorProps {
  containerElement: HTMLDivElement;
  logs: LogListModel[];
  dataFrames: DataFrame[];
}

const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 20;

/**
 * FieldSelector wrapper for the LogList visualization.
 */
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

  const clearFields = useCallback(() => {
    setDisplayedFields?.([]);
  }, [setDisplayedFields]);

  const collapse = useCallback(() => {
    setSidebarWidth(MIN_WIDTH);
  }, []);

  const expand = useCallback(() => {
    const width = getSidebarWidth(logOptionsStorageKey);
    setSidebarWidth(width < 2 * MIN_WIDTH ? DEFAULT_WIDTH : width);
  }, [logOptionsStorageKey]);

  const handleResize: ResizeCallback = useCallback(
    (event, direction, ref) => {
      setSidebarWidth(ref.clientWidth);
      store.set(`${logOptionsStorageKey}.fieldSelector.width`, ref.clientWidth);
    },
    [logOptionsStorageKey]
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
    return;
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
  }),
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
  reorder: (fields: string[]) => void;
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

function getSuggestedFields(logs: LogListModel[], displayedFields: string[]) {
  const suggestedFields: FieldWithStats[] = [];
  if (config.featureToggles.otelLogsFormatting) {
    getDisplayedFieldsForLogs(logs).forEach((field) => {
      suggestedFields.push({
        name: field,
        stats: {
          percentOfLinesWithLabel: 100,
        },
      });
    });
  }

  if (displayedFields.length && !suggestedFields.find((field) => field.name === LOG_LINE_BODY_FIELD_NAME)) {
    suggestedFields.push({
      name: LOG_LINE_BODY_FIELD_NAME,
      stats: {
        percentOfLinesWithLabel: 100,
      },
    });
  }

  return suggestedFields;
}

function getSidebarWidth(logOptionsStorageKey?: string): number {
  const width =
    (logOptionsStorageKey
      ? parseInt(store.get(`${logOptionsStorageKey}.fieldSelector.width`) ?? DEFAULT_WIDTH, 10)
      : undefined) ?? DEFAULT_WIDTH;

  return width < MIN_WIDTH ? MIN_WIDTH : width;
}
