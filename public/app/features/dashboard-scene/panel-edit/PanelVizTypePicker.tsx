import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState } from '@grafana/scenes';
import { CustomScrollbar, FilterInput, useStyles2 } from '@grafana/ui';
import { VizTypePicker } from 'app/features/panel/components/VizTypePicker/VizTypePicker';

import { VizPanelManager } from './VizPanelManager';

export interface PanelVizTypePickerState extends SceneObjectState {}

export function PanelVizTypePicker({
  panelManager,
  onChange,
}: {
  panelManager: VizPanelManager;
  onChange: () => void;
}) {
  const { panel } = panelManager.useState();
  const styles = useStyles2(getStyles);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className={styles.wrapper}>
      <FilterInput
        className={styles.filter}
        value={searchQuery}
        onChange={setSearchQuery}
        autoFocus={true}
        placeholder="Search for..."
      />
      <CustomScrollbar>
        <VizTypePicker
          pluginId={panel.state.pluginId}
          searchQuery={searchQuery}
          onChange={(options) => {
            panelManager.changePluginType(options.pluginId);
            onChange();
          }}
        />
      </CustomScrollbar>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    padding: theme.spacing(1),
    height: '100%',
    gap: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRight: 'none',
    borderBottom: 'none',
    borderTopLeftRadius: theme.shape.radius.default,
  }),
  filter: css({
    minHeight: theme.spacing(4),
  }),
});
