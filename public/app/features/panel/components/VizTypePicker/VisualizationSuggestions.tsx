import React from 'react';
import { Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, PanelData, PanelPluginMeta, PanelModel, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';
import { VizTypeChangeDetails } from './types';
import { VisualizationPreview } from './VisualizationPreview';
import { getAllSuggestions } from '../../state/getAllSuggestions';
import { useAsync, useLocalStorage } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

export interface Props {
  current: PanelPluginMeta;
  data?: PanelData;
  panel?: PanelModel;
  onChange: (options: VizTypeChangeDetails) => void;
  searchQuery: string;
  onClose: () => void;
}

export function VisualizationSuggestions({ onChange, data, panel }: Props) {
  const styles = useStyles2(getStyles);
  const { value: suggestions } = useAsync(() => getAllSuggestions(data, panel), [data, panel]);
  const [columnCount, setColumnCount] = useLocalStorage(`VisualizationSuggestions.columnCount`, 1);
  // temp test
  const [showTitle, setShowTitle] = useLocalStorage(`VisualizationSuggestions.showTitle`, false);

  return (
    <AutoSizer disableHeight style={{ width: '100%', height: '100%' }}>
      {({ width }) => {
        if (!width) {
          return null;
        }

        const spaceBetween = 8 * (columnCount! - 1);
        const previewWidth = (width - spaceBetween) / columnCount!;

        return (
          <div>
            <div className={styles.filterRow}>
              <div className={styles.infoText} onClick={() => setShowTitle(!showTitle)}>
                Based on current data
              </div>
              <Field label="Size">
                <RadioButtonGroup size="sm" options={getSizeOptions()} value={columnCount} onChange={setColumnCount} />
              </Field>
            </div>
            <div className={styles.grid} style={{ gridTemplateColumns: `repeat(auto-fill, ${previewWidth - 1}px)` }}>
              {suggestions &&
                suggestions.map((suggestion, index) => (
                  <VisualizationPreview
                    key={index}
                    data={data!}
                    suggestion={suggestion}
                    onChange={onChange}
                    width={previewWidth}
                    showTitle={showTitle}
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      ...theme.typography.h5,
      margin: theme.spacing(0, 0.5, 1),
    }),
    filterRow: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    }),
    infoText: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
    grid: css({
      display: 'grid',
      gridGap: theme.spacing(1),
      gridTemplateColumns: 'repeat(auto-fill, 144px)',
      marginBottom: theme.spacing(1),
      justifyContent: 'space-evenly',
    }),
  };
};
