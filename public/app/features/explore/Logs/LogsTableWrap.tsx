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
import { Themeable2 } from '@grafana/ui/src';

// do we want to import from prom?
import { fuzzySearch } from '../../../plugins/datasource/prometheus/querybuilder/components/metrics-modal/uFuzzy';
import { parseLogsFrame } from '../../logs/logsFrame';

import { LogsColumnSearch } from './LogsColumnSearch';
import { LogsTable } from './LogsTable';
import { LogsTableMultiSelect } from './LogsTableMultiSelect';

interface Props extends Themeable2 {
  logsFrames: DataFrame[];
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

    labelCount: css({}),
    checkbox: css({}),
  };
}

export type fieldNameMeta = { percentOfLinesWithLabel: number; active: boolean | undefined };
type fieldName = string;
type labelName = string;
type labelValue = string;

const getTableHeight = memoizeOne((dataFrames: DataFrame[] | undefined) => {
  const largestFrameLength = dataFrames?.reduce((length, frame) => {
    return frame.length > length ? frame.length : length;
  }, 0);
  // from TableContainer.tsx
  return Math.min(600, Math.max(largestFrameLength ?? 0, 300) + 40 + 46);
});

const normalize = (value: number, total: number): number => {
  return Math.floor((100 * value) / total);
};

export const LogsTableWrap: React.FunctionComponent<Props> = (props) => {
  const { logsFrames } = props;
  // Save the normalized cardinality of each label
  const [columnsWithMeta, setColumnsWithMeta] = React.useState<Record<fieldName, fieldNameMeta> | undefined>(undefined);

  // Filtered copy of columnsWithMeta that only includes matching results
  const [filteredColumnsWithMeta, setFilteredColumnsWithMeta] = React.useState<
    Record<fieldName, fieldNameMeta> | undefined
  >(undefined);

  const dataFrame = logsFrames[0];
  const logsFrame = parseLogsFrame(dataFrame);

  useEffect(() => {
    const labelsField = dataFrame ? dataFrame.fields.find((field) => field.name === 'labels') : undefined;
    const numberOfLogLines = dataFrame ? dataFrame.length : 0;

    const otherFields = logsFrame ? logsFrame.extraFields : [];
    if (logsFrame?.severityField) {
      otherFields.push(logsFrame?.severityField);
    }

    // Use a map to dedupe labels and count their occurrences in the logs
    const labelCardinality = new Map<fieldName, fieldNameMeta>();

    // What the label state will look like
    let pendingLabelState: Record<fieldName, fieldNameMeta> = {};

    // If we have labels and log lines
    if (labelsField?.values.length && numberOfLogLines) {
      // Iterate through all of labels
      labelsField?.values.forEach((labels: Array<Record<labelName, labelValue>>) => {
        const labelsArray = Object.keys(labels);
        // Iterate through the labels
        labelsArray.forEach((label) => {
          if (labelCardinality.has(label)) {
            const value = labelCardinality.get(label);
            if (value) {
              // extra conditional to appease typescript, we know we have the value with has above? @todo there has to be a better pattern
              labelCardinality.set(label, {
                percentOfLinesWithLabel: value.percentOfLinesWithLabel + 1,
                active: value?.active,
              });
            }
          } else {
            labelCardinality.set(label, { percentOfLinesWithLabel: 1, active: undefined });
          }
        });
      });

      // Converting the Map to an Object will be expensive, hoping the savings from deduping with set/map above will make up for it
      pendingLabelState = Object.fromEntries(labelCardinality);

      // Convert count to percent of log lines
      Object.keys(pendingLabelState).forEach((key) => {
        pendingLabelState[key].percentOfLinesWithLabel = normalize(
          pendingLabelState[key].percentOfLinesWithLabel,
          numberOfLogLines
        );
      });
    }

    // Normalize the other fields
    otherFields.forEach((field) => {
      pendingLabelState[field.name] = {
        percentOfLinesWithLabel: normalize(field.values.filter((value) => value).length, numberOfLogLines),
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
    // Query changed, reset the local search state.
    setFilteredColumnsWithMeta(undefined);
    // including dataFrame and logsFrame will cause infinite loop
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.datasourceType, dataFrame]);

  if (!columnsWithMeta) {
    return null;
  }

  // Toggle a column on or off when the user interacts with an element in the multi-select sidebar
  const toggleColumn = (columnName: fieldName) => {
    if (!columnsWithMeta || !(columnName in columnsWithMeta)) {
      console.warn('failed to get column', columnsWithMeta);
      return;
    }
    const pendingLabelState = {
      ...columnsWithMeta,
      [columnName]: { ...columnsWithMeta[columnName], active: !columnsWithMeta[columnName]?.active },
    };

    // Set local state
    setColumnsWithMeta(pendingLabelState);

    // If user is currently filtering, update filtered state
    if (filteredColumnsWithMeta) {
      const pendingFilteredLabelState = {
        ...filteredColumnsWithMeta,
        [columnName]: { ...filteredColumnsWithMeta[columnName], active: !filteredColumnsWithMeta[columnName]?.active },
      };
      setFilteredColumnsWithMeta(pendingFilteredLabelState);
    }

    const newPanelState: ExploreLogsPanelState = {
      ...props.panelState,
      // URL format requires our array of values be an object, so we convert it using object.assign
      columns: Object.assign(
        {},
        // Get the keys of the object as an array
        Object.keys(pendingLabelState)
          // Only include active filters
          .filter((key) => pendingLabelState[key]?.active)
      ),
      visualisationType: 'table',
    };

    // Update url state
    props.updatePanelState(newPanelState);
  };

  // uFuzzy search dispatcher, adds any matches to the local state
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

  // uFuzzy search
  const search = (needle: string) => {
    fuzzySearch(Object.keys(columnsWithMeta), needle, dispatcher);
  };

  // Debounce fuzzy search
  const debouncedSearch = debounce(search, 500);

  // onChange handler for search input
  const onSearchInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget?.value;
    if (value) {
      debouncedSearch(value);
    } else {
      // If the search input is empty, reset the local search state.
      setFilteredColumnsWithMeta(undefined);
    }
  };

  const height = getTableHeight(logsFrames);
  const sidebarWidth = 220;
  const totalWidth = props.width;
  const tableWidth = totalWidth - sidebarWidth;
  const styles = getStyles(props.theme, height, sidebarWidth);

  return (
    <div className={styles.wrapper}>
      <section className={styles.sidebar}>
        <LogsColumnSearch onChange={onSearchInputChange} />
        <LogsTableMultiSelect
          toggleColumn={toggleColumn}
          filteredColumnsWithMeta={filteredColumnsWithMeta}
          columnsWithMeta={columnsWithMeta}
        />
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
        columnsWithMeta={columnsWithMeta}
        height={height}
        datasourceType={props.datasourceType}
      />
    </div>
  );
};
