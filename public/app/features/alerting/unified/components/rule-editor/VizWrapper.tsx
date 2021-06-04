import React, { FC, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelData } from '@grafana/data';
import { config, PanelRenderer } from '@grafana/runtime';
import { RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { PanelOptions } from 'app/plugins/panel/table/models.gen';
import { SupportedPanelPlugins } from './QueryWrapper';
import { useVizHeight } from '../../hooks/useVizHeight';
import { STAT, TABLE, TIMESERIES } from '../../utils/constants';

interface Props {
  data: PanelData;
  currentPanel: SupportedPanelPlugins;
  changePanel: (panel: SupportedPanelPlugins) => void;
}

export const VizWrapper: FC<Props> = ({ data, currentPanel, changePanel }) => {
  const [options, setOptions] = useState<PanelOptions>({
    frameIndex: 0,
    showHeader: true,
  });
  const panels = getSupportedPanels();
  const vizHeight = useVizHeight(data, currentPanel, options.frameIndex);
  const styles = useStyles2(getStyles(vizHeight));

  if (!options || !data) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.buttonGroup}>
        <RadioButtonGroup options={panels} value={currentPanel} onChange={changePanel} />
      </div>
      <AutoSizer>
        {({ width }) => {
          if (width === 0) {
            return null;
          }
          return (
            <div style={{ height: `${vizHeight}px`, width: `${width}px` }}>
              <PanelRenderer
                height={vizHeight}
                width={width}
                data={data}
                pluginId={currentPanel}
                title="title"
                onOptionsChange={setOptions}
                options={options}
              />
            </div>
          );
        }}
      </AutoSizer>
    </div>
  );
};

const getSupportedPanels = () => {
  return Object.values(config.panels)
    .filter((p) => p.id === TIMESERIES || p.id === TABLE || p.id === STAT)
    .map((panel) => ({ value: panel.id, label: panel.name, imgUrl: panel.info.logos.small }));
};

const getStyles = (visHeight: number) => (theme: GrafanaTheme2) => ({
  wrapper: css`
    padding: 0 ${theme.spacing(2)};
    height: ${visHeight + theme.spacing.gridSize * 4}px;
  `,
  autoSizerWrapper: css`
    width: 100%;
    height: 200px;
  `,
  buttonGroup: css`
    display: flex;
    justify-content: flex-end;
  `,
});
