import React, { FC, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelData } from '@grafana/data';
import { config, PanelRenderer } from '@grafana/runtime';
import { RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { PanelOptions } from 'app/plugins/panel/table/models.gen';
import { useVizHeight } from '../../hooks/useVizHeight';
import { STAT, TABLE, TIMESERIES } from '../../utils/constants';

interface Props {
  data: PanelData;
  defaultPanel?: 'timeseries' | 'table' | 'stat';
}

export const VizWrapper: FC<Props> = ({ data, defaultPanel }) => {
  const [pluginId, changePluginId] = useState<string>(defaultPanel ?? TIMESERIES);
  const [options, setOptions] = useState<PanelOptions>({
    frameIndex: 0,
    showHeader: true,
  });
  const panels = getSupportedPanels();
  const vizHeight = useVizHeight(data, pluginId, options.frameIndex);
  const styles = useStyles2(getStyles);

  if (!options || !data) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.buttonGroup}>
        <RadioButtonGroup options={panels} value={pluginId} onChange={changePluginId} />
      </div>
      <div style={{ height: vizHeight, width: '100%' }}>
        <AutoSizer style={{ width: '100%', height: '100%' }}>
          {({ width, height }) => {
            if (width === 0 || height === 0) {
              return null;
            }
            return (
              <PanelRenderer
                height={height}
                width={width}
                data={data}
                pluginId={pluginId}
                title="title"
                onOptionsChange={setOptions}
                options={options}
              />
            );
          }}
        </AutoSizer>
      </div>
    </div>
  );
};

const getSupportedPanels = () => {
  return Object.values(config.panels)
    .filter((p) => p.id === TIMESERIES || p.id === TABLE || p.id === STAT)
    .map((panel) => ({ value: panel.id, label: panel.name, imgUrl: panel.info.logos.small }));
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    padding: 0 ${theme.spacing(2)};
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
