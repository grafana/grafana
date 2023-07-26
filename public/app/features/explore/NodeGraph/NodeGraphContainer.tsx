import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useToggle, useWindowSize } from 'react-use';

import { applyFieldOverrides, DataFrame, GrafanaTheme2, SplitOpen } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Collapse, useStyles2, useTheme2 } from '@grafana/ui';

import { NodeGraph } from '../../../plugins/panel/nodeGraph';
import { useCategorizeFrames } from '../../../plugins/panel/nodeGraph/useCategorizeFrames';
import { StoreState } from '../../../types';
import { useLinks } from '../utils/links';

const getStyles = (theme: GrafanaTheme2) => ({
  warningText: css`
    label: warningText;
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
  `,
});

interface OwnProps {
  // Edges and Nodes are separate frames
  dataFrames: DataFrame[];
  exploreId: string;
  // When showing the node graph together with trace view we do some changes so it works better.
  withTraceView?: boolean;
  datasourceType: string;
  splitOpenFn: SplitOpen;
}

type Props = OwnProps & ConnectedProps<typeof connector>;

export function UnconnectedNodeGraphContainer(props: Props) {
  const { dataFrames, range, splitOpenFn, withTraceView, datasourceType } = props;
  const getLinks = useLinks(range, splitOpenFn);
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
  const toggled = () => {
    toggleOpen();
    reportInteraction('grafana_traces_node_graph_panel_clicked', {
      datasourceType: datasourceType,
      grafana_version: config.buildInfo.version,
      isExpanded: !open,
    });
  };

  // Calculate node graph height based on window and top position, with some padding
  const { height: windowHeight } = useWindowSize();
  const containerRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(250);
  useEffect(() => {
    if (containerRef.current) {
      const { top } = containerRef.current.getBoundingClientRect();
      setTop(top);
    }
  }, [containerRef]);
  const height = windowHeight - top - 32;

  const countWarning =
    withTraceView && nodes[0]?.length > 1000 ? (
      <span className={styles.warningText}> ({nodes[0].length} nodes, can be slow to load)</span>
    ) : null;

  return (
    <Collapse
      label={<span>Node graph{countWarning} </span>}
      collapsible={withTraceView}
      // We allow collapsing this only when it is shown together with trace view.
      isOpen={withTraceView ? open : true}
      onToggle={withTraceView ? () => toggled() : undefined}
    >
      <div
        ref={containerRef}
        style={
          withTraceView
            ? { height: 500 }
            : {
                minHeight: 600,
                height,
              }
        }
      >
        <NodeGraph dataFrames={frames} getLinks={getLinks} />
      </div>
    </Collapse>
  );
}

function mapStateToProps(state: StoreState, { exploreId }: OwnProps) {
  return {
    range: state.explore.panes[exploreId]!.range,
  };
}

const connector = connect(mapStateToProps, {});
export const NodeGraphContainer = connector(UnconnectedNodeGraphContainer);
