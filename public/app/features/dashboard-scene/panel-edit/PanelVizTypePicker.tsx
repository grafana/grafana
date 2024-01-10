import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { CustomScrollbar, FilterInput, useStyles2 } from '@grafana/ui';
import { VizTypePicker } from 'app/features/panel/components/VizTypePicker/VizTypePicker';

import { VizPanelManager } from './VizPanelManager';

export interface PanelVizTypePickerState extends SceneObjectState {}

export class PanelVizTypePicker extends SceneObjectBase<PanelVizTypePickerState> {
  public constructor(public panelManager: VizPanelManager) {
    super({});
  }

  static Component = ({ model }: SceneComponentProps<PanelVizTypePicker>) => {
    const { panelManager } = model;
    const { panel } = panelManager.useState();
    const styles = useStyles2(getStyles);
    const [searchQuery, setSearchQuery] = useState('');

    return (
      <CustomScrollbar autoHeightMin="100%">
        <div className={styles.wrapper}>
          <FilterInput value={searchQuery} onChange={setSearchQuery} autoFocus={true} placeholder="Search for..." />
          <VizTypePicker
            pluginId={panel.state.pluginId}
            searchQuery={searchQuery}
            onChange={(options) => {
              panelManager.changePluginType(options.pluginId);
            }}
          />
        </div>
      </CustomScrollbar>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
});
