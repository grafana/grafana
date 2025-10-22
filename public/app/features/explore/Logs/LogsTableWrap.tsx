import { css } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';

import {
  DataFrame,
  ExploreLogsPanelState,
  GrafanaTheme2,
  Labels,
  LogRowModel,
  LogsSortOrder,
  SelectableValue,
  SplitOpen,
  TimeRange,
  AbsoluteTimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { InlineField, Select, Themeable2 } from '@grafana/ui';

import { DEFAULT_URL_COLUMNS, DETECTED_LEVEL, LEVEL, LogsFrame, parseLogsFrame } from '../../logs/logsFrame';

import { LogsColumnSearch } from './LogsColumnSearch';
import { LogsTable } from './LogsTable';
import { LogsTableMultiSelect } from './LogsTableMultiSelect';
import { fuzzySearch } from './utils/uFuzzy';

interface Props extends Themeable2 {
  logsFrames: DataFrame[];
  width: number;
  timeZone: string;
  splitOpen: SplitOpen;
  range: TimeRange;
  logsSortOrder: LogsSortOrder;
  panelState: ExploreLogsPanelState | undefined;
  updatePanelState: (panelState: Partial<ExploreLogsPanelState>) => void;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  datasourceType?: string;
  exploreId?: string;
  displayedFields?: string[];
  visualisationType?: 'table';
  absoluteRange?: AbsoluteTimeRange;
  logRows?: LogRowModel[];
}

type ActiveFieldMeta = {
  active: false;
  index: undefined; // if undefined the column is not selected
};

type InactiveFieldMeta = {
  active: true;
  index: number; // if undefined the column is not selected
};

type GenericMeta = {
  percentOfLinesWithLabel: number;
  type?: 'BODY_FIELD' | 'TIME_FIELD' | 'LEVEL_FIELD';
};

export type FieldNameMeta = (InactiveFieldMeta | ActiveFieldMeta) & GenericMeta;

type FieldName = string;
type FieldNameMetaStore = Record<FieldName, FieldNameMeta>;

export function LogsTableWrap(props: Props) {
  const { logsFrames, updatePanelState, panelState } = props;
  const propsColumns = panelState?.columns;
  // Save the normalized cardinality of each label
  const [columnsWithMeta, setColumnsWithMeta] = useState<FieldNameMetaStore | undefined>(undefined);

  // Filtered copy of columnsWithMeta that only includes matching results
  const [filteredColumnsWithMeta, setFilteredColumnsWithMeta] = useState<FieldNameMetaStore | undefined>(undefined);
  const [searchValue, setSearchValue] = useState<string>('');

  const height = getLogsTableHeight();
  const panelStateRefId = props?.panelState?.refId;

  // The current dataFrame containing the refId of the current query
  const [currentDataFrame, setCurrentDataFrame] = useState<DataFrame>(
    logsFrames.find((f) => f.refId === panelStateRefId) ?? logsFrames[0]
  );

  const getColumnsFromProps = useCallback(
    (fieldNames: FieldNameMetaStore) => {
      const previouslySelected = props.panelState?.columns;
      if (previouslySelected) {
        Object.values(previouslySelected).forEach((key, index) => {
          if (fieldNames[key]) {
            fieldNames[key].active = true;
            fieldNames[key].index = index;
          }
        });

        // Reorder to ensure special fields come first
        fieldNames = reorderColumnsToEnsureSpecialFieldsFirst(fieldNames);
      }
      return fieldNames;
    },
    [props.panelState?.columns]
  );

  const getColumnsFromDisplayedFields = useCallback(
    (fieldNames: FieldNameMetaStore, columnIndex: number) => {
      const previouslySelected = props.panelState?.displayedFields;
      if (previouslySelected) {
        Object.values(previouslySelected).forEach((key) => {
          columnIndex++;
          if (fieldNames[key]) {
            fieldNames[key].active = true;
            fieldNames[key].index = columnIndex;
          }
        });

        // Reorder to ensure special fields come first
        fieldNames = reorderColumnsToEnsureSpecialFieldsFirst(fieldNames);
      }
      return fieldNames;
    },
    [props.panelState?.displayedFields]
  );

  const logsFrame = parseLogsFrame(currentDataFrame);

  const updateDisplayedFields = useCallback(
    (pendingLabelState: FieldNameMetaStore): string[] => {
      // Get all active columns and sort by index
      const newColumnsArray = Object.keys(pendingLabelState)
        .filter((key) => pendingLabelState[key]?.active)
        .sort((a, b) => {
          const pa = pendingLabelState[a];
          const pb = pendingLabelState[b];
          if (pa.index !== undefined && pb.index !== undefined) {
            return pa.index - pb.index;
          }
          return 0;
        });

      const newColumns = Object.values(newColumnsArray);
      const levelName = getLevelFieldNameFromLabels(logsFrame);

      // Filter out default columns and level field
      return newColumns.filter((column) => !DEFAULT_URL_COLUMNS.includes(column) && column !== levelName);
    },
    [logsFrame]
  );

  useEffect(() => {
    if (logsFrame?.timeField.name && logsFrame?.bodyField.name && !propsColumns) {
      const levelName = getLevelFieldNameFromLabels(logsFrame);
      const defaultColumns: Record<number, string> = levelName
        ? {
            0: logsFrame.timeField.name,
            1: levelName,
            2: logsFrame.bodyField.name,
          }
        : {
            0: logsFrame.timeField.name,
            1: logsFrame.bodyField.name,
          };
      updatePanelState({
        columns: Object.values(defaultColumns),
        visualisationType: 'table',
        labelFieldName: logsFrame?.getLabelFieldName() ?? undefined,
      });
    }
  }, [logsFrame, propsColumns, updatePanelState]);

  /**
   * When logs frame updates (e.g. query|range changes), we need to set the selected frame to state
   */
  useEffect(() => {
    const newFrame = logsFrames.find((f) => f.refId === panelStateRefId) ?? logsFrames[0];
    if (newFrame) {
      setCurrentDataFrame(newFrame);
    }
  }, [logsFrames, panelStateRefId]);

  /**
   * Keeps the filteredColumnsWithMeta state in sync with the columnsWithMeta state,
   * which can be updated by explore browser history state changes
   * This prevents an edge case bug where the user is navigating while a search is open.
   * Also syncs displayedFields from URL on load.
   */
  useEffect(() => {
    if (!columnsWithMeta || !filteredColumnsWithMeta) {
      return;
    }
    let newFiltered = { ...filteredColumnsWithMeta };
    let flag = false;
    Object.keys(columnsWithMeta).forEach((key) => {
      if (newFiltered[key] && newFiltered[key].active !== columnsWithMeta[key].active) {
        newFiltered[key] = columnsWithMeta[key];
        flag = true;
      }
    });
    if (flag) {
      setFilteredColumnsWithMeta(newFiltered);
    }
  }, [columnsWithMeta, filteredColumnsWithMeta]);

  /**
   * when the query results change, we need to update the columnsWithMeta state
   * and reset any local search state
   *
   * This will also find all the unique labels, and calculate how many log lines have each label into the labelCardinality Map
   * Then it normalizes the counts
   *
   */
  useEffect(() => {
    // If the data frame is empty, there's nothing to viz, it could mean the user has unselected all columns
    if (!currentDataFrame.length) {
      return;
    }
    const numberOfLogLines = currentDataFrame ? currentDataFrame.length : 0;
    const logsFrame = parseLogsFrame(currentDataFrame);
    const labels = logsFrame?.getLogFrameLabelsAsLabels();

    const otherFields = [];

    if (logsFrame) {
      otherFields.push(...logsFrame.extraFields.filter((field) => !field?.config?.custom?.hidden));
    }

    if (logsFrame?.bodyField) {
      otherFields.push(logsFrame?.bodyField);
    }

    if (logsFrame?.timeField) {
      otherFields.push(logsFrame?.timeField);
    }

    // Use a map to dedupe labels and count their occurrences in the logs
    const labelCardinality = new Map<FieldName, FieldNameMeta>();

    // What the label state will look like
    let pendingLabelState: FieldNameMetaStore = {};

    // If we have labels and log lines
    if (labels?.length && numberOfLogLines) {
      // Iterate through all of Labels
      labels.forEach((labels: Labels) => {
        const labelsArray = Object.keys(labels);
        // Iterate through the label values
        labelsArray.forEach((label) => {
          // If it's already in our map, increment the count
          if (labelCardinality.has(label)) {
            const value = labelCardinality.get(label);
            if (value) {
              if (value?.active) {
                labelCardinality.set(label, {
                  percentOfLinesWithLabel: value.percentOfLinesWithLabel + 1,
                  active: true,
                  index: value.index,
                });
              } else {
                labelCardinality.set(label, {
                  percentOfLinesWithLabel: value.percentOfLinesWithLabel + 1,
                  active: false,
                  index: undefined,
                });
              }
            }
            // Otherwise add it
          } else {
            labelCardinality.set(label, { percentOfLinesWithLabel: 1, active: false, index: undefined });
          }
        });
      });

      // Converting the map to an object
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
      const isActive = pendingLabelState[field.name]?.active;
      const index = pendingLabelState[field.name]?.index;
      if (isActive && index !== undefined) {
        pendingLabelState[field.name] = {
          percentOfLinesWithLabel: normalize(
            field.values.filter((value) => value !== null && value !== undefined).length,
            numberOfLogLines
          ),
          active: true,
          index: index,
        };
      } else {
        pendingLabelState[field.name] = {
          percentOfLinesWithLabel: normalize(
            field.values.filter((value) => value !== null && value !== undefined).length,
            numberOfLogLines
          ),
          active: false,
          index: undefined,
        };
      }
    });

    pendingLabelState = getColumnsFromProps(pendingLabelState);

    // Get all active columns
    const active = Object.keys(pendingLabelState).filter((key) => pendingLabelState[key].active);

    // If nothing is selected, then select the default columns
    // Keep track of the column index to set the displayed fields in the correct order
    let columnIndex = 0;
    if (active.length === 0) {
      if (logsFrame?.timeField?.name) {
        pendingLabelState[logsFrame.timeField.name].active = true;
        pendingLabelState[logsFrame.timeField.name].index = columnIndex++;
      }

      // Check for level field by name in the pendingLabelState (populated from labels)
      const levelName = getLevelFieldName(pendingLabelState);
      if (levelName) {
        pendingLabelState[levelName].active = true;
        pendingLabelState[levelName].index = columnIndex++;
      }

      if (logsFrame?.bodyField?.name) {
        pendingLabelState[logsFrame.bodyField.name].active = true;
        pendingLabelState[logsFrame.bodyField.name].index = columnIndex++;
      }
    }

    if (logsFrame?.bodyField?.name && logsFrame?.timeField?.name) {
      pendingLabelState[logsFrame.bodyField.name].type = 'BODY_FIELD';
      pendingLabelState[logsFrame.timeField.name].type = 'TIME_FIELD';

      // Mark level field type - check in pendingLabelState
      const levelName = getLevelFieldName(pendingLabelState);
      if (levelName && pendingLabelState[levelName]) {
        pendingLabelState[levelName].type = 'LEVEL_FIELD';
      }
    }

    // Sync displayed fields from URL
    pendingLabelState = getColumnsFromDisplayedFields(pendingLabelState, columnIndex);

    setColumnsWithMeta(pendingLabelState);

    // The panel state is updated when the user interacts with the multi-select sidebar
  }, [currentDataFrame, getColumnsFromProps, getColumnsFromDisplayedFields, props.panelState?.displayedFields]);

  const onSortByChange = useCallback(
    (sortBy: Array<{ displayName: string; desc?: boolean }>) => {
      // Transform from Table format to URL format - only store the first sort column
      if (sortBy.length > 0) {
        props.updatePanelState({
          tableSortBy: sortBy[0].displayName,
          tableSortDir: sortBy[0].desc ? 'desc' : 'asc',
        });
      }
    },
    [props]
  );

  const [sidebarWidth, setSidebarWidth] = useState(220);
  const tableWidth = props.width - sidebarWidth;

  if (!columnsWithMeta) {
    return null;
  }

  function columnFilterEvent(columnName: string) {
    if (columnsWithMeta) {
      const newState = !columnsWithMeta[columnName]?.active;
      const priorActiveCount = Object.keys(columnsWithMeta).filter((column) => columnsWithMeta[column]?.active)?.length;
      const event = {
        columnAction: newState ? 'add' : 'remove',
        columnCount: newState ? priorActiveCount + 1 : priorActiveCount - 1,
        datasourceType: props.datasourceType,
      };
      reportInteraction('grafana_explore_logs_table_column_filter_clicked', event);
    }
  }

  function searchFilterEvent(searchResultCount: number) {
    reportInteraction('grafana_explore_logs_table_text_search_result_count', {
      resultCount: searchResultCount,
      datasourceType: props.datasourceType ?? 'unknown',
    });
  }

  const clearSelection = () => {
    let pendingLabelState = { ...columnsWithMeta };
    let index = 0;
    Object.keys(pendingLabelState).forEach((key) => {
      const isDefaultField = !!pendingLabelState[key].type;
      // after reset the only active fields are the special time, level, and body fields
      pendingLabelState[key].active = isDefaultField;
      // set temporary index for reordering
      pendingLabelState[key].index = isDefaultField ? index++ : undefined;
    });

    // Reorder to ensure special fields come first in correct order (time, level, body)
    pendingLabelState = reorderColumnsToEnsureSpecialFieldsFirst(pendingLabelState);

    setColumnsWithMeta(pendingLabelState);

    // Update explore state to sync with URL
    updateExploreState(pendingLabelState);
  };

  const reorderColumn = (sourceIndex: number, destinationIndex: number) => {
    if (sourceIndex === destinationIndex) {
      return;
    }

    const pendingLabelState = { ...columnsWithMeta };

    const keys = Object.keys(pendingLabelState)
      .filter((key) => pendingLabelState[key].active)
      .map((key) => ({
        fieldName: key,
        index: pendingLabelState[key].index ?? 0,
      }))
      .sort((a, b) => a.index - b.index);

    const [source] = keys.splice(sourceIndex, 1);
    keys.splice(destinationIndex, 0, source);

    keys.forEach((key, index) => {
      pendingLabelState[key.fieldName].index = index;
    });

    // Set local state
    setColumnsWithMeta(pendingLabelState);

    // Sync the explore state
    updateExploreState(pendingLabelState);
  };

  function updateExploreState(pendingLabelState: FieldNameMetaStore) {
    // Get all active columns and sort by index
    const newColumnsArray = Object.keys(pendingLabelState)
      // Only include active filters
      .filter((key) => pendingLabelState[key]?.active)
      .sort((a, b) => {
        const pa = pendingLabelState[a];
        const pb = pendingLabelState[b];
        if (pa.index !== undefined && pb.index !== undefined) {
          return pa.index - pb.index; // sort by index
        }
        return 0;
      });

    const newColumns: Record<number, string> = Object.assign(
      {},
      // Get the keys of the object as an array
      newColumnsArray
    );

    const levelName = getLevelFieldNameFromLabels(logsFrame);
    const defaultColumns: Record<number, string> = levelName
      ? {
          0: logsFrame?.timeField.name ?? '',
          1: levelName,
          2: logsFrame?.bodyField.name ?? '',
        }
      : {
          0: logsFrame?.timeField.name ?? '',
          1: logsFrame?.bodyField.name ?? '',
        };

    // Use the extracted updateDisplayedFields function
    const newDisplayedFields = updateDisplayedFields(pendingLabelState);

    const newPanelState: ExploreLogsPanelState = {
      ...props.panelState,
      // URL format requires our array of values be an object, so we convert it using object.assign
      columns: Object.keys(newColumns).length ? newColumns : defaultColumns,
      displayedFields: newDisplayedFields,
      refId: currentDataFrame.refId,
      visualisationType: 'table',
      labelFieldName: logsFrame?.getLabelFieldName() ?? undefined,
      tableSortBy: props.panelState?.tableSortBy,
      tableSortDir: props.panelState?.tableSortDir,
    };

    // Update url state
    updatePanelState(newPanelState);
  }

  // Toggle a column on or off when the user interacts with an element in the multi-select sidebar
  const toggleColumn = (columnName: FieldName) => {
    if (!columnsWithMeta || !(columnName in columnsWithMeta)) {
      console.warn('failed to get column', columnsWithMeta);
      return;
    }

    const length = Object.keys(columnsWithMeta).filter((c) => columnsWithMeta[c].active).length;
    const isActive = !columnsWithMeta[columnName].active ? true : undefined;

    let pendingLabelState: FieldNameMetaStore;
    if (isActive) {
      // Activating a column - set temporary index and let reorder function handle proper placement
      pendingLabelState = {
        ...columnsWithMeta,
        [columnName]: {
          ...columnsWithMeta[columnName],
          active: isActive,
          index: length,
        },
      };

      // Reorder to ensure special fields come first
      pendingLabelState = reorderColumnsToEnsureSpecialFieldsFirst(pendingLabelState);
    } else {
      // Deactivating a column
      pendingLabelState = {
        ...columnsWithMeta,
        [columnName]: {
          ...columnsWithMeta[columnName],
          active: false,
          index: undefined,
        },
      };

      // Reorder to ensure proper sequential indices
      pendingLabelState = reorderColumnsToEnsureSpecialFieldsFirst(pendingLabelState);
    }

    // Analytics
    columnFilterEvent(columnName);

    // Set local state
    setColumnsWithMeta(pendingLabelState);

    // If user is currently filtering, update filtered state
    if (filteredColumnsWithMeta) {
      const active = !filteredColumnsWithMeta[columnName]?.active;
      let pendingFilteredLabelState: FieldNameMetaStore;

      if (active) {
        pendingFilteredLabelState = {
          ...filteredColumnsWithMeta,
          [columnName]: {
            ...filteredColumnsWithMeta[columnName],
            active: active,
            index: length,
          },
        };

        // Reorder to ensure special fields come first
        pendingFilteredLabelState = reorderColumnsToEnsureSpecialFieldsFirst(pendingFilteredLabelState);
      } else {
        pendingFilteredLabelState = {
          ...filteredColumnsWithMeta,
          [columnName]: {
            ...filteredColumnsWithMeta[columnName],
            active: false,
            index: undefined,
          },
        };

        // Reorder to ensure proper sequential indices
        pendingFilteredLabelState = reorderColumnsToEnsureSpecialFieldsFirst(pendingFilteredLabelState);
      }

      setFilteredColumnsWithMeta(pendingFilteredLabelState);
    }

    updateExploreState(pendingLabelState);
  };

  // uFuzzy search dispatcher, adds any matches to the local state
  const dispatcher = (data: string[][]) => {
    const matches = data[0];
    let newColumnsWithMeta: FieldNameMetaStore = {};
    let numberOfResults = 0;
    matches.forEach((match) => {
      if (match in columnsWithMeta) {
        newColumnsWithMeta[match] = columnsWithMeta[match];
        numberOfResults++;
      }
    });
    setFilteredColumnsWithMeta(newColumnsWithMeta);
    searchFilterEvent(numberOfResults);
  };

  // uFuzzy search
  const search = (needle: string) => {
    fuzzySearch(Object.keys(columnsWithMeta), needle, dispatcher);
  };

  // onChange handler for search input
  const onSearchInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget?.value;
    setSearchValue(value);
    if (value) {
      search(value);
    } else {
      // If the search input is empty, reset the local search state.
      setFilteredColumnsWithMeta(undefined);
    }
  };

  const onFrameSelectorChange = (value: SelectableValue<string>) => {
    const matchingDataFrame = logsFrames.find((frame) => frame.refId === value.value);
    if (matchingDataFrame) {
      setCurrentDataFrame(logsFrames.find((frame) => frame.refId === value.value) ?? logsFrames[0]);
    }
    props.updatePanelState({ refId: value.value, labelFieldName: logsFrame?.getLabelFieldName() ?? undefined });
  };

  const styles = getStyles(props.theme, height, sidebarWidth);

  const getOnResize: ResizeCallback = (event, direction, ref) => {
    const newSidebarWidth = Number(ref.style.width.slice(0, -2));
    if (!isNaN(newSidebarWidth)) {
      setSidebarWidth(newSidebarWidth);
    }
  };

  return (
    <>
      <div>
        {logsFrames.length > 1 && (
          <div>
            <InlineField
              label={t('explore.logs-table-wrap.label-select-query', 'Select query')}
              htmlFor="explore_logs_table_frame_selector"
              labelWidth={22}
              tooltip={t(
                'explore.logs-table-wrap.tooltip-select-query-visualize-table',
                'Select a query to visualize in the table'
              )}
            >
              <Select
                inputId={'explore_logs_table_frame_selector'}
                aria-label={t('explore.logs-table-wrap.aria-label-select-query-by-name', 'Select query by name')}
                value={currentDataFrame.refId}
                options={logsFrames.map((frame) => {
                  return {
                    label: frame.refId,
                    value: frame.refId,
                  };
                })}
                onChange={onFrameSelectorChange}
              />
            </InlineField>
          </div>
        )}
      </div>
      <div className={styles.wrapper}>
        <Resizable
          enable={{
            right: true,
          }}
          handleClasses={{ right: styles.rzHandle }}
          onResize={getOnResize}
        >
          <section className={styles.sidebar}>
            <LogsColumnSearch value={searchValue} onChange={onSearchInputChange} />
            <LogsTableMultiSelect
              reorderColumn={reorderColumn}
              toggleColumn={toggleColumn}
              filteredColumnsWithMeta={filteredColumnsWithMeta}
              columnsWithMeta={columnsWithMeta}
              clear={clearSelection}
            />
          </section>
        </Resizable>
        <LogsTable
          logsFrame={logsFrame}
          onClickFilterLabel={props.onClickFilterLabel}
          onClickFilterOutLabel={props.onClickFilterOutLabel}
          logsSortOrder={props.logsSortOrder}
          range={props.range}
          splitOpen={props.splitOpen}
          timeZone={props.timeZone}
          width={tableWidth}
          dataFrame={currentDataFrame}
          columnsWithMeta={columnsWithMeta}
          height={height}
          sortBy={
            props.panelState?.tableSortBy
              ? [{ displayName: props.panelState.tableSortBy, desc: props.panelState.tableSortDir === 'desc' }]
              : undefined
          }
          onSortByChange={onSortByChange}
          exploreId={props.exploreId}
          displayedFields={props.displayedFields}
          panelState={props.panelState}
          visualisationType={props.visualisationType}
          absoluteRange={props.absoluteRange}
          logRows={props.logRows}
        />
      </div>
    </>
  );
}

const normalize = (value: number, total: number): number => {
  return Math.ceil((100 * value) / total);
};

/**
 * Reorders columns to ensure special fields (TIME_FIELD, LEVEL_FIELD, BODY_FIELD) always come first
 */
const reorderColumnsToEnsureSpecialFieldsFirst = (fieldNames: FieldNameMetaStore): FieldNameMetaStore => {
  // Get all active columns sorted by their current index
  const activeColumns = Object.keys(fieldNames)
    .filter((key) => fieldNames[key].active && fieldNames[key].index !== undefined)
    .sort((a, b) => {
      const indexA = fieldNames[a].index!;
      const indexB = fieldNames[b].index!;
      return indexA - indexB;
    });

  // Separate special fields from regular fields
  const specialFields: Array<{ key: string; type: string; priority: number }> = [];
  const regularFields: string[] = [];

  activeColumns.forEach((key) => {
    const type = fieldNames[key].type;
    if (type === 'TIME_FIELD') {
      specialFields.push({ key, type, priority: 0 });
    } else if (type === 'LEVEL_FIELD') {
      specialFields.push({ key, type, priority: 1 });
    } else if (type === 'BODY_FIELD') {
      specialFields.push({ key, type, priority: 2 });
    } else {
      regularFields.push(key);
    }
  });

  // Sort special fields by their priority
  specialFields.sort((a, b) => a.priority - b.priority);

  // Combine special fields first, then regular fields
  const orderedColumns = [...specialFields.map((f) => f.key), ...regularFields];

  // Create new fieldNames with updated indices
  const reorderedFieldNames = { ...fieldNames };
  orderedColumns.forEach((key, index) => {
    const field = reorderedFieldNames[key];
    if (field.active && field.index !== undefined) {
      reorderedFieldNames[key] = {
        percentOfLinesWithLabel: field.percentOfLinesWithLabel,
        type: field.type,
        active: true,
        index,
      };
    }
  });

  return reorderedFieldNames;
};

const getLevelFieldName = (columnsWithMeta: FieldNameMetaStore): string | undefined => {
  // Prioritize detected_level over level
  if (DETECTED_LEVEL in columnsWithMeta) {
    return DETECTED_LEVEL;
  }
  if (LEVEL in columnsWithMeta) {
    return LEVEL;
  }
  return undefined;
};

const getLevelFieldNameFromLabels = (logsFrame: LogsFrame | null): string | undefined => {
  // Check for level field in labels
  const labels = logsFrame?.getLogFrameLabelsAsLabels();
  if (labels && labels.length > 0) {
    // Check if any label object has detected_level or level
    for (const labelObj of labels) {
      if (DETECTED_LEVEL in labelObj) {
        return DETECTED_LEVEL;
      } else if (LEVEL in labelObj) {
        return LEVEL;
      }
    }
  }
  return undefined;
};

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
      paddingRight: theme.spacing(3),
    }),
    rzHandle: css({
      background: theme.colors.secondary.main,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: '0.3s background ease-in-out',
      },
      position: 'relative',
      height: '50% !important',
      width: `${theme.spacing(1)} !important`,
      top: '25% !important',
      right: `${theme.spacing(1)} !important`,
      cursor: 'grab',
      borderRadius: theme.shape.radius.pill,
      ['&:hover']: {
        background: theme.colors.secondary.shade,
      },
    }),
  };
}

export const getLogsTableHeight = () => {
  // Instead of making the height of the table based on the content (like in the table panel itself), let's try to use the vertical space that is available.
  // Since this table is in explore, we can expect the user to be running multiple queries that return disparate numbers of rows and labels in the same session
  // Also changing the height of the table between queries can be and cause content to jump, so we'll set a minimum height of 500px, and a max based on the innerHeight
  // Ideally the table container should always be able to fit in the users viewport without needing to scroll
  return Math.max(window.innerHeight - 500, 500);
};
