import { css } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import { startTransition, useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getDragStyles, useStyles2 } from '@grafana/ui';
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

/**
 * FieldSelector wrapper for the LogList visualization.
 */
export const LogListFieldSelector = ({ containerElement, dataFrames, logs }: LogListFieldSelectorProps) => {
  const [sidebarHeight, setSidebarHeight] = useState(220);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const { displayedFields, onClickShowField, onClickHideField, setDisplayedFields } = useLogListContext();
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

  const handleResize: ResizeCallback = useCallback((event, direction, ref) => {
    setSidebarWidth(ref.clientWidth);
  }, []);

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
    console.log('no height');
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
      onResize={handleResize}
    >
      <FieldSelector
        activeFields={displayedFields}
        clear={clearFields}
        fields={fields}
        reorder={setDisplayedFields}
        suggestedFields={suggestedFields}
        toggle={toggleField}
      />
    </Resizable>
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
  fields: FieldWithStats[];
  reorder: (fields: string[]) => void;
  suggestedFields: FieldWithStats[];
  toggle: (key: string) => void;
}

export const FieldSelector = ({
  activeFields,
  clear,
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

  return (
    <section className={styles.sidebar}>
      <FieldSearch value={searchValue} onChange={onSearchInputChange} />
      <FieldList
        activeFields={activeFields}
        clear={clear}
        fields={fields}
        reorder={reorder}
        suggestedFields={suggestedFields}
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
