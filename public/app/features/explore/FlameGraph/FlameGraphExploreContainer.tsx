import { css } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';

import { type DataFrame, type GrafanaTheme2, CoreApp } from '@grafana/data';
import { FlameGraph, FLAMEGRAPH_CONTAINER_HEIGHT } from '@grafana/flamegraph';
import { config, reportInteraction } from '@grafana/runtime';
import { useFlagFlameGraphTableNg } from '@grafana/runtime/internal';
import { useStyles2, useTheme2 } from '@grafana/ui';

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
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const enableNewUI = useBooleanFlagValue('flameGraphWithCallTree', false);
  const useTableNG = useFlagFlameGraphTableNg();

  return (
    <div className={styles.container}>
      <FlameGraph
        data={props.dataFrames[0]}
        stickyHeader={true}
        getTheme={() => theme}
        enableNewUI={enableNewUI}
        useTableNG={useTableNG}
        onTableSymbolClick={() => interaction('table_item_selected')}
        onViewSelected={(view: string) => interaction('view_selected', { view })}
        onTextAlignSelected={(align: string) => interaction('text_align_selected', { align })}
        onTableSort={(sort: string) => interaction('table_sort_selected', { sort })}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  // FlameGraph's own root is styled height: 100%, on the assumption that its host bounds its height (like a
  // dashboard panel does). Explore doesn't - it lays out this container with the page's natural flow - so
  // without an explicit height here, that 100% resolves against an indefinite ancestor and collapses several
  // layers down inside FlameGraph, most visibly truncating the top table. Give it the same fixed height the
  // old always-800px table styling relied on, so FlameGraph has a real height to size against in Explore.
  container: css({
    background: theme.colors.background.primary,
    display: 'flow-root',
    height: FLAMEGRAPH_CONTAINER_HEIGHT,
    padding: theme.spacing(0, 1, 1, 1),
    border: `1px solid ${theme.components.panel.borderColor}`,
    borderRadius: theme.shape.radius.default,
  }),
});
