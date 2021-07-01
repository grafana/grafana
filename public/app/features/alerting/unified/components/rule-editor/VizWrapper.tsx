import React, { FC, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelData } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { PanelOptions } from 'app/plugins/panel/table/models.gen';
import { useVizHeight } from '../../hooks/useVizHeight';
import { SupportedPanelPlugins, PanelPluginsButtonGroup } from '../PanelPluginsButtonGroup';

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
  const vizHeight = useVizHeight(data, currentPanel, options.frameIndex);
  const styles = useStyles2(getStyles(vizHeight));

  if (!options || !data) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.buttonGroup}>
        <PanelPluginsButtonGroup onChange={changePanel} value={currentPanel} />
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

const getStyles = (visHeight: number) => (theme: GrafanaTheme2) => ({
  wrapper: css`
    padding: 0 ${theme.spacing(2)};
    height: ${visHeight + theme.spacing.gridSize * 4}px;
  `,
  buttonGroup: css`
    display: flex;
    justify-content: flex-end;
  `,
});
