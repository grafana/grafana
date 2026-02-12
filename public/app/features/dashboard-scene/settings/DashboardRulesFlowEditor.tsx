import { css } from '@emotion/css';
import {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { DashboardRules } from '../conditional-rendering/rules/DashboardRules';
import { DashboardScene } from '../scene/DashboardScene';

import { ConditionNode, OutcomeNode, RuleNode, TargetNode } from './flow-nodes/FlowNodes';

interface Props {
  dashboard: DashboardScene;
}

const nodeTypes = {
  ruleNode: RuleNode,
  targetNode: TargetNode,
  conditionNode: ConditionNode,
  outcomeNode: OutcomeNode,
};

export function DashboardRulesFlowEditor({ dashboard }: Props) {
  const styles = useStyles2(getStyles);
  const { dashboardRules } = dashboard.useState();

  const { initialNodes, initialEdges } = useMemo(
    () => buildFlowFromRules(dashboardRules),
    [dashboardRules]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className={styles.wrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap />
        <Panel position="top-right">
          <Button size="sm" icon="plus" variant="primary" onClick={() => {}}>
            Add rule
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

/**
 * Convert the DashboardRules SceneObject into React Flow nodes and edges.
 * Each rule becomes a group: target -> conditions -> outcomes.
 */
function buildFlowFromRules(dashboardRules?: DashboardRules): {
  initialNodes: Node[];
  initialEdges: Edge[];
} {
  if (!dashboardRules) {
    return { initialNodes: [], initialEdges: [] };
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const rules = dashboardRules.state.rules;

  rules.forEach((rule, ruleIdx) => {
    const ruleY = ruleIdx * 300;
    const ruleId = `rule-${ruleIdx}`;

    // Rule node (group header)
    nodes.push({
      id: ruleId,
      type: 'ruleNode',
      position: { x: 0, y: ruleY },
      data: {
        label: rule.state.name || `Rule ${ruleIdx + 1}`,
        match: rule.state.match,
      },
    });

    // Target node
    const targetId = `${ruleId}-target`;
    const target = rule.state.target;
    nodes.push({
      id: targetId,
      type: 'targetNode',
      position: { x: 250, y: ruleY },
      data: {
        kind: target.kind,
        name: target.name,
      },
    });

    edges.push({
      id: `${ruleId}-to-target`,
      source: ruleId,
      target: targetId,
      animated: true,
    });

    // Condition nodes
    rule.state.conditions.forEach((condition, condIdx) => {
      const condId = `${ruleId}-cond-${condIdx}`;
      const serialized = condition.serialize();

      nodes.push({
        id: condId,
        type: 'conditionNode',
        position: { x: 500, y: ruleY + condIdx * 80 },
        data: {
          kind: serialized.kind,
          spec: serialized.spec,
        },
      });

      edges.push({
        id: `${ruleId}-to-cond-${condIdx}`,
        source: ruleId,
        target: condId,
        label: condIdx === 0 ? 'if' : rule.state.match,
      });
    });

    // Outcome nodes
    rule.state.outcomes.forEach((outcome, outIdx) => {
      const outId = `${ruleId}-outcome-${outIdx}`;

      nodes.push({
        id: outId,
        type: 'outcomeNode',
        position: { x: 800, y: ruleY + outIdx * 80 },
        data: {
          kind: outcome.kind,
          spec: outcome.spec,
        },
      });

      // Connect conditions to outcomes
      edges.push({
        id: `target-to-outcome-${ruleIdx}-${outIdx}`,
        source: targetId,
        target: outId,
        label: 'then',
        animated: true,
      });
    });
  });

  return { initialNodes: nodes, initialEdges: edges };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      flex: 1,
      width: '100%',
      height: '100%',
      minHeight: 600,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
    }),
  };
}
