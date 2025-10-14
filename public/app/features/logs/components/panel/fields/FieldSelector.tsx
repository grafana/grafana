import { css } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import { startTransition, useCallback, useMemo, useState } from 'react';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { getDragStyles, useStyles2 } from '@grafana/ui';
import { parseLogsFrame } from 'app/features/logs/logsFrame';

import { useLogListContext } from '../LogListContext';

import { FieldList } from './FieldList';
import { FieldSearch } from './FieldSearch';

interface LogListFieldSelectorProps {
  containerElement: HTMLDivElement;
  dataFrames: DataFrame[];
}

/**
 * FieldSelector wrapper for the LogList visualization.
 */
export const LogListFieldSelector = ({ containerElement, dataFrames }: LogListFieldSelectorProps) => {
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const { onClickShowField, onClickHideField, setDisplayedFields } = useLogListContext();

  const dragStyles = useStyles2(getDragStyles);

  const getOnResize: ResizeCallback = useCallback((event, direction, ref) => {
    const newSidebarWidth = Number(ref.style.width.slice(0, -2));
    if (!isNaN(newSidebarWidth)) {
      setSidebarWidth(newSidebarWidth);
    }
  }, []);

  const fields = useMemo(() => getFieldsWithStats(dataFrames), [dataFrames]);

  if (!onClickShowField || !onClickHideField || !setDisplayedFields) {
    console.warn('Missing required props: onClickShowField, onClickHideField, setDisplayedFields');
    return null;
  }

  return (
    <Resizable
      enable={{
        right: true,
      }}
      handleClasses={{ right: dragStyles.dragHandleVertical }}
      defaultSize={{ width: sidebarWidth }}
      onResize={getOnResize}
    >
      <FieldSelector
        fields={fields}
        hideField={onClickHideField}
        showField={onClickShowField}
        setFields={setDisplayedFields}
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
  fields: FieldWithStats[];
  hideField: (key: string) => void;
  setFields: (displayedFields: string[]) => void;
  showField: (key: string) => void;
}

export const FieldSelector = ({ showField, hideField, setFields }: FieldSelectorProps) => {
  const [searchValue, setSearchValue] = useState<string>('');
  const styles = useStyles2(getStyles);

  const onSearchInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    startTransition(() => {
      setSearchValue(e.currentTarget.value);
    });
  };

  return (
    <section className={styles.sidebar}>
      <FieldSearch value={searchValue} onChange={onSearchInputChange} />
      <FieldList
        reorderColumn={() => {}}
        toggleColumn={() => {}}
        filteredColumnsWithMeta={{}}
        columnsWithMeta={{}}
        clear={() => {}}
      />
    </section>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    sidebar: css({
      fontSize: theme.typography.pxToRem(11),
      paddingRight: theme.spacing(3),
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
