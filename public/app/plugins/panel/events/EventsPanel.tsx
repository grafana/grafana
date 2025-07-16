import { useMemo } from 'react';

import {
    DashboardCursorSync,
    DataFrame,
    FieldMatcherID,
    PanelProps,
    FieldType,
    DisplayValue,
    MutableDataFrame, GrafanaTheme2,
} from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { TableCellDisplayMode } from '@grafana/schema';
import { Table, usePanelContext, useTheme2 } from '@grafana/ui';
import { TableSortByFieldState } from '@grafana/ui/src/components/Table/types';

import { hasDeprecatedParentRowIndex, migrateFromParentRowIndexToNestedFrames } from '../table/migrations';

import { SeverityDotCell } from './SeverityDotCell';
import { TagsCell } from './TagsCell';
import { Options } from './panelcfg.gen';

interface Props extends PanelProps<Options> { }

// Event severity types
type EventSeverity = 'unknown' | 'info' | 'warning' | 'error';

// Function to get severity color
function getSeverityColor(severity: EventSeverity, theme: GrafanaTheme2) {
    switch (severity.toLowerCase()) {
        case 'error':
            return theme.colors.error.main;
        case 'warning':
            return theme.colors.warning.main;
        case 'info':
            return theme.colors.info.main;
        case 'unknown':
        default:
            return theme.colors.text.secondary;
    }
}

// Function to merge all data into a single events series
function mergeEventsData(theme: GrafanaTheme2, frames: DataFrame[], fieldConfig?: any): DataFrame {
    if (frames.length === 0) {
        return new MutableDataFrame();
    }

    const mergedFrame = new MutableDataFrame();

    // Add the specified columns
    mergedFrame.addField({ name: 'Type', type: FieldType.string });
    mergedFrame.addField({ name: 'Title', type: FieldType.string });
    mergedFrame.addField({ name: 'Tags', type: FieldType.string });
    mergedFrame.addField({ name: 'Time', type: FieldType.time });
    mergedFrame.addField({ name: 'RawEvent', type: FieldType.string });

    // Hide the RawEvent field from table display
    const rawEventField = mergedFrame.fields.find(f => f.name === 'RawEvent');
    if (rawEventField) {
        rawEventField.config = rawEventField.config || {};
        rawEventField.config.custom = rawEventField.config.custom || {};
        rawEventField.config.custom.hidden = true;
    }

    // Process each frame and extract data (only one sample per series)
    frames.forEach((frame) => {
        if (frame.length === 0) { return; }

        // Only process the first row from each frame (one sample per series)
        const i = 0;
        const row: any = {};

        // Extract values from all fields in this row
        frame.fields.forEach((field) => {
            const value = field.values.get(i);
            row[field.name] = value;

            // Also extract data from labels if they exist
            if (field.labels && typeof field.labels === 'object') {
                Object.keys(field.labels).forEach((labelKey) => {
                    row[labelKey] = field.labels![labelKey];
                });
            }
        });

        // Extract the specified columns
        const alertType = row.alert_type;
        const message = row.title;
        const timeMs = Number(row.oodle_event_time_epoch_ms);
        const rawEvent = row.oodle_raw_event;

        // Collect all other fields as tags
        const tags: string[] = [];
        Object.keys(row).forEach((key) => {
            const value = row[key];
            if (value !== null && value !== undefined && value !== '' &&
                !['alert_type', 'datadog_events_v1', 'date_happened', 'datadog_events', 'AlertType', 'alerttype', 'title', 'MsgTitle', 'message', 'Message', 'msg',
                    'oodle_event_time_epoch_ms', 'OodleEventTimeEpochMs', 'time', 'Time', '__name__'].includes(key)) {
                tags.push(`${key}: ${value}`);
            }
        });

        // Add the row to merged frame
        mergedFrame.add({
            Type: alertType,
            Title: message,
            Time: timeMs,
            Tags: tags.join(', '),
            RawEvent: rawEvent,
        });
    });

    // Apply field configuration overrides FIRST to preserve user-resized column widths
    if (fieldConfig && fieldConfig.overrides) {
        fieldConfig.overrides.forEach((override: any) => {
            if (override.matcher.id === FieldMatcherID.byName) {
                const fieldName = override.matcher.options;
                const field = mergedFrame.fields.find(f => f.name === fieldName);
                if (field) {
                    override.properties.forEach((prop: any) => {
                        if (prop.id === 'custom.width') {
                            field.config = field.config || {};
                            field.config.custom = field.config.custom || {};
                            field.config.custom.width = prop.value;
                        }
                    });
                }
            }
        });
    }

    // Add custom display functions
    mergedFrame.fields.forEach((field) => {
        if (field.name === 'Type') {
            field.display = (value: any): DisplayValue => {
                const severity = (value || 'unknown').toLowerCase() as EventSeverity;
                const color = getSeverityColor(severity, theme);

                return {
                    text: '', // Empty text, we'll use custom styling
                    color: color,
                    numeric: 0,
                };
            };
            // Set default width for the Type column (only if not already set by override)
            field.config = field.config || {};
            field.config.custom = field.config.custom || {};
            if (field.config.custom.width === undefined) {
                field.config.custom.width = 50;
            }
            field.config.custom.align = 'center';
            // Configure custom cell renderer
            field.config.custom.cellOptions = {
                type: TableCellDisplayMode.Custom,
                cellComponent: SeverityDotCell,
            };
        } else if (field.name === 'Title') {
            field.display = (value: any): DisplayValue => {
                return {
                    text: value || 'No title',
                    numeric: 0,
                };
            };
            // Configure as InspectableDataLink cell
            field.config = field.config || {};
            field.config.custom = field.config.custom || {};
            field.config.custom.cellOptions = {
                type: TableCellDisplayMode.InspectableDataLink,
            };
            // Store raw event data in field config for access in getLinks
            field.config.custom.rawEventData = mergedFrame.fields.find(f => f.name === 'RawEvent')?.values.toArray() || [];
            // Set up data links for the raw event data
            field.getLinks = (config) => {
                const rowIndex = config.valueRowIndex;
                if (rowIndex !== undefined) {
                    // Get the raw event data from the field configuration
                    const rawEventData = field.config?.custom?.rawEventData?.[rowIndex] || '';
                    return [{
                        title: 'View Raw Event',
                        href: `${encodeURI(rawEventData)}`,
                        target: '_blank',
                        origin: field,
                    }];
                }
                return [];
            };
        } else if (field.name === 'Time') {
            field.display = (value: any): DisplayValue => {
                if (!value) { return { text: 'Unknown time', numeric: 0 }; }
                const date = new Date(value);
                return {
                    text: date.toLocaleString(),
                    numeric: value,
                };
            };
            field.config = field.config || {};
            field.config.custom = field.config.custom || {};
            // Set default width for Time column (only if not already set by override)
            if (field.config.custom.width === undefined) {
                field.config.custom.width = 190;
            }
        } else if (field.name === 'Tags') {
            field.display = (value: any): DisplayValue => {
                if (!value || value === '') { return { text: '', numeric: 0 }; }
                return {
                    text: value,
                    numeric: 0,
                };
            };
            // Configure custom cell renderer for Tags
            field.config = field.config || {};
            field.config.custom = field.config.custom || {};
            field.config.custom.cellOptions = {
                type: TableCellDisplayMode.Custom,
                cellComponent: TagsCell,
            };
        }
    });

    return mergedFrame;
}

export function EventsPanel(props: Props) {
    const { data, height, width, options, fieldConfig, id, timeRange } = props;

    const theme = useTheme2();
    const panelContext = usePanelContext();
    const frames = hasDeprecatedParentRowIndex(data.series)
        ? migrateFromParentRowIndexToNestedFrames(data.series)
        : data.series;
    const count = frames?.length;
    const hasFields = frames.some((frame) => frame.fields.length > 0);

    let tableHeight = height;

    // Merge all data into a single events series with memoization
    const mergedData = useMemo(() => {
        return mergeEventsData(theme, frames, fieldConfig);
    }, [theme, frames, fieldConfig]);

    if (!count || !hasFields) {
        return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
    }

    if (mergedData.length === 0) {
        return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
    }

    const enableSharedCrosshair = panelContext.sync && panelContext.sync() !== DashboardCursorSync.Off;

    const tableElement = (
        <Table
            height={tableHeight}
            width={width}
            data={mergedData}
            noHeader={!options.showHeader}
            showTypeIcons={options.showTypeIcons}
            resizable={true}
            initialSortBy={options.sortBy}
            onSortByChange={(sortBy) => onSortByChange(sortBy, props)}

            onCellFilterAdded={panelContext.onAddAdHocFilter}
            footerOptions={options.footer}
            enablePagination={options.footer?.enablePagination}
            cellHeight={options.cellHeight}
            timeRange={timeRange}
            enableSharedCrosshair={config.featureToggles.tableSharedCrosshair && enableSharedCrosshair}
            fieldConfig={fieldConfig}
        />
    );

    return tableElement;
}




function onSortByChange(sortBy: TableSortByFieldState[], props: Props) {
    const { onOptionsChange, options } = props;
    onOptionsChange({
        ...options,
        sortBy,
    });
}

