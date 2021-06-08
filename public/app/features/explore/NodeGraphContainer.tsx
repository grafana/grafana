import React from 'react';
import { useToggle } from 'react-use';
import { Badge, Collapse, useStyles2, useTheme2 } from '@grafana/ui';
import { applyFieldOverrides, DataFrame, GrafanaTheme2, TimeRange } from '@grafana/data';
import { css } from '@emotion/css';
import { ExploreId, StoreState } from '../../types';
import { splitOpen } from './state/main';
import { connect, ConnectedProps } from 'react-redux';
import { useLinks } from './utils/links';
import { NodeGraph } from '../../plugins/panel/nodeGraph';
import { useCategorizeFrames } from '../../plugins/panel/nodeGraph/useCategorizeFrames';

const getStyles = (theme: GrafanaTheme2) => ({
  warningText: css`
    label: warningText;
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
  `,
});

interface Props {
  // Edges and Nodes are separate frames
  dataFrames: DataFrame[];
  exploreId: ExploreId;
  range: TimeRange;
  splitOpen: typeof splitOpen;
  // When showing the node graph together with trace view we do some changes so it works better.
  withTraceView?: boolean;
}
export function UnconnectedNodeGraphContainer(props: Props & ConnectedProps<typeof connector>) {
  const { dataFrames, range, splitOpen, withTraceView } = props;
  const getLinks = useLinks(range, splitOpen);
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  // This is implicit dependency that is needed for links to work. At some point when replacing variables in the link
  // it requires field to have a display property which is added by the overrides even though we don't add any field
  // overrides in explore.
  const frames = applyFieldOverrides({
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    data: dataFrames,
    // We don't need proper replace here as it is only used in getLinks and we use getFieldLinks
    replaceVariables: (value) => value,
    theme,
  });

  const { nodes } = useCategorizeFrames(frames);
  const [open, toggleOpen] = useToggle(false);

  const countWarning =
    withTraceView && nodes[0]?.length > 1000 ? (
      <span className={styles.warningText}> ({nodes[0].length} nodes, can be slow to load)</span>
    ) : null;

  return (
    <Collapse
      label={
        <span>
          Node graph{countWarning}{' '}
          <Badge text={'Beta'} color={'blue'} icon={'rocket'} tooltip={'This visualization is in beta'} />
        </span>
      }
      collapsible={withTraceView}
      // We allow collapsing this only when it is shown together with trace view.
      isOpen={withTraceView ? open : true}
      onToggle={withTraceView ? () => toggleOpen() : undefined}
    >
      <div style={{ height: withTraceView ? 500 : 600 }}>
        <NodeGraph dataFrames={frames} getLinks={getLinks} />
      </div>
    </Collapse>
  );
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  return {
    range: state.explore[exploreId]!.range,
  };
}

const mapDispatchToProps = {
  splitOpen,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export const NodeGraphContainer = connector(UnconnectedNodeGraphContainer);
