import React, { useMemo, useState } from 'react';
import { VizTypePickerPlugin } from './VizTypePickerPlugin';
import { EmptySearchResult, Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, PanelData, PanelPluginMeta, PanelModel, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';
import { filterPluginList, getAllPanelPluginMeta } from '../../state/util';
import { VizTypeChangeDetails } from './types';
import { getAllSuggestions } from './getAllSuggestions';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { VisualizationPreview } from './VisualizationPreview';

export interface Props {
  current: PanelPluginMeta;
  data?: PanelData;
  panel?: PanelModel;
  onChange: (options: VizTypeChangeDetails) => void;
  searchQuery: string;
  onClose: () => void;
}

export function VizTypePicker({ searchQuery, onChange, current, data, panel }: Props) {
  const styles = useStyles2(getStyles);
  const pluginsList: PanelPluginMeta[] = useMemo(() => {
    return getAllPanelPluginMeta();
  }, []);

  const filteredPluginTypes = useMemo((): PanelPluginMeta[] => {
    return filterPluginList(pluginsList, searchQuery, current);
  }, [current, pluginsList, searchQuery]);

  const [columnCount, setColumnCount] = useState<number>(1);

  const { value: suggestions } = useAsync(() => getAllSuggestions(data, panel), [data, panel]);

  if (filteredPluginTypes.length === 0) {
    return <EmptySearchResult>Could not find anything matching your query</EmptySearchResult>;
  }

  return (
    <AutoSizer disableHeight style={{ width: '100%', height: '100%' }}>
      {({ width }) => {
        if (!width) {
          return null;
        }

        const spaceBetween = 8 * (columnCount - 1);
        const previewWidth = (width - spaceBetween) / columnCount;
        const headingClass = columnCount > 1 ? styles.colSpan2 : '';

        return (
          <div>
            <div className={styles.filterRow}>
              <Field label="Filters">
                <RadioButtonGroup size="sm" options={getTypeFilters()} value="all" />
              </Field>

              <Field label="Size">
                <RadioButtonGroup size="sm" options={getSizeOptions()} value={columnCount} onChange={setColumnCount} />
              </Field>
            </div>

            <div className={styles.grid} style={{ gridTemplateColumns: `repeat(auto-fill, ${previewWidth - 1}px)` }}>
              {suggestions && suggestions?.length > 0 && (
                <>
                  <div className={headingClass}>Suggestions</div>
                  {suggestions.map((suggestion, index) => (
                    <VisualizationPreview
                      key={index}
                      data={data!}
                      suggestion={suggestion}
                      onChange={onChange}
                      width={previewWidth}
                    />
                  ))}
                </>
              )}
              <div className={headingClass}>Visualization plugins</div>
              {filteredPluginTypes.map((plugin, index) => (
                <VizTypePickerPlugin
                  disabled={false}
                  key={plugin.id}
                  isCurrent={plugin.id === current.id}
                  plugin={plugin}
                  onClick={(e) =>
                    onChange({
                      pluginId: plugin.id,
                      withModKey: Boolean(e.metaKey || e.ctrlKey || e.altKey),
                    })
                  }
                />
              ))}
            </div>
          </div>
        );
      }}
    </AutoSizer>
  );
}

function getSizeOptions(): Array<SelectableValue<number>> {
  return [
    { value: 2, icon: 'columns', description: 'Two column layout' },
    { value: 1, icon: 'square', description: 'Single column layout' },
  ];
}

function getTypeFilters(): Array<SelectableValue<string>> {
  return [
    { value: 'all', label: 'All', description: 'All' },
    { value: 'viz', icon: 'chart-line', description: 'Data visualizations' },
    { value: 'viz', icon: 'apps', description: 'Widgets like dashboard list, alert list, clock, news and text panels' },
  ];
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    grid: css({
      display: 'grid',
      gridGap: theme.spacing(1),
      gridTemplateColumns: 'repeat(auto-fill, 144px)',
      marginBottom: theme.spacing(1),
      justifyContent: 'space-evenly',
    }),
    filterRow: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
    }),
    colSpan2: css({
      gridColumn: '1 / span 2',
    }),
  };
};
