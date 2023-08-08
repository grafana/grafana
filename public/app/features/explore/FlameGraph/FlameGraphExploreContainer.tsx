import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, GrafanaTheme2, CoreApp } from '@grafana/data';
import { FlameGraph } from '@grafana/flamegraph';
import { reportInteraction, config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

interface Props {
  dataFrames: DataFrame[];
}

function interaction(name: string, context: Record<string, string | number> = {}) {
  reportInteraction(`grafana_flamegraph_${name}`, {
    app: CoreApp.Unknown,
    grafana_version: config.buildInfo.version,
    ...context,
  });
}

export const FlameGraphExploreContainer = (props: Props) => {
  const styles = useStyles2((theme) => getStyles(theme));

  return (
    <div className={styles.container}>
      <FlameGraph
        data={props.dataFrames[0]}
        stickyHeader={true}
        getTheme={() => config.theme2}
        onTableSymbolClick={() => interaction('table_item_selected')}
        onViewSelected={(view: string) => interaction('view_selected', { view })}
        onTextAlignSelected={(align: string) => interaction('text_align_selected', { align })}
        onTableSort={(sort: string) => interaction('table_sort_selected', { sort })}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    background: ${theme.colors.background.primary};
    display: flow-root;
    padding: 0 ${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)};
    border: 1px solid ${theme.components.panel.borderColor};
    border-radius: ${theme.shape.radius.default};
  `,
});
