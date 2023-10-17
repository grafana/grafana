import { css } from '@emotion/css';
import { debounce } from 'lodash';
import memoizeOne from 'memoize-one';
import React, { useEffect } from 'react';

import {
  DataFrame,
  ExploreLogsPanelState,
  GrafanaTheme2,
  LogsSortOrder,
  SplitOpen,
  TimeRange,
} from '@grafana/data/src';
import { Field, Input, Themeable2 } from '@grafana/ui/src';

// do we want to import from prom?
import { fuzzySearch } from '../../../plugins/datasource/prometheus/querybuilder/components/metrics-modal/uFuzzy';

import { LogsTable } from './LogsTable';
import { LogsTableNavColumn } from './LogsTableNavColumn';

interface Props extends Themeable2 {
  logsFrames?: DataFrame[];
  width: number;
  timeZone: string;
  splitOpen: SplitOpen;
  range: TimeRange;
  logsSortOrder: LogsSortOrder;
  panelState: ExploreLogsPanelState | undefined;
  updatePanelState: (panelState: Partial<ExploreLogsPanelState>) => void;
  onClickFilterLabel?: (key: string, value: string, refId?: string) => void;
  onClickFilterOutLabel?: (key: string, value: string, refId?: string) => void;
  datasourceType?: string;
}

function getStyles(theme: GrafanaTheme2, height: number, width: number) {
  return {
    wrapper: css({
      display: 'flex',
    }),
    sidebar: css({
      height: height,
      fontSize: theme.typography.pxToRem(11),
      overflowY: 'hidden',
      width: width,
      paddingRight: theme.spacing(1.5),
    }),
    sidebarWrap: css({
      overflowY: 'scroll',
      height: 'calc(100% - 50px)',
    }),
    searchWrap: css({
      padding: theme.spacing(0.4),
    }),
    columnHeader: css({
      fontSize: theme.typography.h6.fontSize,
      background: theme.colors.background.secondary,
      position: 'sticky',
      top: 0,
      left: 0,
      padding: '6px 6px 6px 15px',
      zIndex: 3,
      marginBottom: theme.spacing(2),
    }),
    labelCount: css({}),
    checkbox: css({}),
  };
}

export type fieldNameMeta = { count: number; active: boolean | undefined };
type fieldName = string;
type labelName = string;
type labelValue = string;

const getTableHeight = memoizeOne((dataFrames: DataFrame[] | undefined) => {
  const largestFrameLength = dataFrames?.reduce((length, frame) => {
    return frame.length > length ? frame.length : length;
  }, 0);
  // from TableContainer.tsx
  return Math.min(600, Math.max(largestFrameLength ?? 0 * 36, 300) + 40 + 46);
});

const normalize = (value: number, total: number): number => {
  return Math.floor((100 * value) / total);
};

// @todo this is a hack to get the other Fields that are used as columns, but we should have a better way to do this
export const LOKI_TABLE_SPECIAL_FIELDS = ['labels', 'id', 'tsNs', 'Line', 'Time'];
export const ELASTIC_TABLE_SPECIAL_FIELDS = ['@timestamp', 'line'];

export const LogsTableWrap: React.FunctionComponent<Props> = (props) => {
  const { logsFrames } = props;
  // Save the normalized cardinality of each label
  const [columnsWithMeta, setColumnsWithMeta] = React.useState<Record<fieldName, fieldNameMeta> | undefined>(undefined);

  const [filteredColumnsWithMeta, setFilteredColumnsWithMeta] = React.useState<
    Record<fieldName, fieldNameMeta> | undefined
  >(undefined);

  useEffect(() => {
    // @todo cleanup
    const labelsField = logsFrames?.length ? logsFrames[0].fields.find((field) => field.name === 'labels') : undefined;
    const numberOfLogLines = logsFrames ? logsFrames[0].length : 0;

    const otherFields = logsFrames?.length
      ? logsFrames[0].fields.filter((field) => {
          if (props.datasourceType === 'loki') {
            return !LOKI_TABLE_SPECIAL_FIELDS.includes(field.name);
          } else if (props.datasourceType === 'elasticsearch') {
            return !ELASTIC_TABLE_SPECIAL_FIELDS.includes(field.name);
          }
          return true;
        })
      : [];

    //@todo this map doesn't need the active state and it should be removed
    const labelCardinality = new Map<fieldName, fieldNameMeta>();
    let pendingLabelState: Record<fieldName, fieldNameMeta> = {};

    if (labelsField?.values.length && numberOfLogLines) {
      labelsField?.values.forEach((labels: Array<Record<labelName, labelValue>>) => {
        const keys = Object.keys(labels);
        keys.forEach((key) => {
          if (labelCardinality.has(key)) {
            const value = labelCardinality.get(key);
            if (value) {
              // extra conditional to appease typescript, we know we have the value with has above? @todo there has to be a better pattern
              labelCardinality.set(key, { count: value.count + 1, active: value?.active });
            }
          } else {
            labelCardinality.set(key, { count: 1, active: undefined });
          }
        });
      });

      // Converting the Map to an Object will be expensive, hoping the savings from deduping with set/map above will make up for it
      pendingLabelState = Object.fromEntries(labelCardinality);

      // Normalize to percent
      Object.keys(pendingLabelState).forEach((key) => {
        pendingLabelState[key].count = normalize(pendingLabelState[key].count, numberOfLogLines);
      });
    }

    // Normalize the other fields
    otherFields.forEach((field) => {
      pendingLabelState[field.name] = {
        count: normalize(field.values.filter((value) => value).length, numberOfLogLines),
        active: pendingLabelState[field.name]?.active,
      };
    });

    // get existing labels from url
    const previouslySelected = props.panelState?.columns;
    if (previouslySelected) {
      Object.values(previouslySelected).forEach((key) => {
        if (pendingLabelState[key]) {
          pendingLabelState[key].active = true;
        }
      });
    }

    setColumnsWithMeta(pendingLabelState);
    // Query changed, reset the search state.
    setFilteredColumnsWithMeta(undefined);
    // We don't want to update the state if the url changes, we want to update the active state when the data is changed.
  }, [logsFrames, props.panelState?.columns, props.datasourceType]);

  const toggleColumn = (columnName: fieldName) => {
    if (!columnsWithMeta || !(columnName in columnsWithMeta)) {
      console.warn('failed to get column', columnsWithMeta);
      return;
    }
    const pendingLabelCardinality = {
      ...columnsWithMeta,
      [columnName]: { ...columnsWithMeta[columnName], active: !columnsWithMeta[columnName]?.active },
    };

    // Set local state
    setColumnsWithMeta(pendingLabelCardinality);

    const newPanelState: ExploreLogsPanelState = {
      ...props.panelState,
      // URL format requires our array of values be an object, so we convert it using object.assign
      columns: Object.assign(
        {},
        // Get the keys of the object as an array
        Object.keys(pendingLabelCardinality)
          // Only include active filters
          .filter((key) => pendingLabelCardinality[key]?.active)
      ),
      visualisationType: 'table',
    };

    // Update url state
    props.updatePanelState(newPanelState);
  };

  if (!columnsWithMeta) {
    return null;
  }

  const height = getTableHeight(logsFrames);
  const sidebarWidth = 220;
  const totalWidth = props.width;
  const tableWidth = totalWidth - sidebarWidth;

  const styles = getStyles(props.theme, height, sidebarWidth);

  const dispatcher = (data: string[][]) => {
    const matches = data[0];
    let newColumnsWithMeta: Record<fieldName, fieldNameMeta> = {};
    matches.forEach((match) => {
      if (match in columnsWithMeta) {
        newColumnsWithMeta[match] = columnsWithMeta[match];
      }
    });
    setFilteredColumnsWithMeta(newColumnsWithMeta);
  };

  const search = (needle: string) => {
    fuzzySearch(Object.keys(columnsWithMeta), needle, dispatcher);
  };

  const debouncedSearch = debounce(search, 500);

  const onChange = (e: React.FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget?.value;
    if (value) {
      debouncedSearch(value);
    } else {
      setFilteredColumnsWithMeta(undefined);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.sidebar}>
        <Field className={styles.searchWrap}>
          <Input type={'text'} placeholder={'Search columns by name'} onChange={onChange} />
        </Field>

        <div className={styles.sidebarWrap}>
          {/* Sidebar columns */}
          <>
            <div className={styles.columnHeader}>Common columns</div>
            <LogsTableNavColumn
              toggleColumn={toggleColumn}
              labels={filteredColumnsWithMeta ?? columnsWithMeta}
              valueFilter={(value) => value === 100}
            />
            <div className={styles.columnHeader}>Available columns</div>
            <LogsTableNavColumn
              toggleColumn={toggleColumn}
              labels={filteredColumnsWithMeta ?? columnsWithMeta}
              valueFilter={(value) => !!value && value !== 100}
            />
            <div className={styles.columnHeader}>Empty columns</div>
            <LogsTableNavColumn
              toggleColumn={toggleColumn}
              labels={filteredColumnsWithMeta ?? columnsWithMeta}
              valueFilter={(value) => !value}
            />
          </>
        </div>
      </section>
      <LogsTable
        onClickFilterLabel={props.onClickFilterLabel}
        onClickFilterOutLabel={props.onClickFilterOutLabel}
        logsSortOrder={props.logsSortOrder}
        range={props.range}
        splitOpen={props.splitOpen}
        timeZone={props.timeZone}
        width={tableWidth}
        logsFrames={logsFrames}
        labelCardinalityState={columnsWithMeta}
        height={height}
        datasourceType={props.datasourceType}
      />
    </div>
  );
};
