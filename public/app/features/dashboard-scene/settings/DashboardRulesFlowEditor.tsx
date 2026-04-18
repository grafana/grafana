import { css } from '@emotion/css';
import {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MarkerType,
  Node,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';

import { DashboardRule } from '../conditional-rendering/rules/DashboardRule';
import { DashboardRules } from '../conditional-rendering/rules/DashboardRules';
import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

import { AddRuleForm } from './AddRuleForm';
import { ConditionConnectorNode, ConditionNode, OutcomeNode, RuleNode, TargetNode } from './flow-nodes/FlowNodes';

interface Props {
  dashboard: DashboardScene;
  /** When true, hides add/edit controls (for use in view mode sidebar). */
  readOnly?: boolean;
  /** When set, overrides live rule evaluation for visual styling (simulator mode). */
  simulatedActiveRules?: Set<number>;
}

const nodeTypes = {
  ruleNode: RuleNode,
  targetNode: TargetNode,
  conditionNode: ConditionNode,
  conditionConnectorNode: ConditionConnectorNode,
  outcomeNode: OutcomeNode,
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
};

export function DashboardRulesFlowEditor({ dashboard, readOnly, simulatedActiveRules }: Props) {
  const { dashboardRules } = dashboard.useState();

  if (dashboardRules) {
    return (
      <ReactiveFlowEditor
        dashboard={dashboard}
        dashboardRules={dashboardRules}
        readOnly={readOnly}
        simulatedActiveRules={simulatedActiveRules}
      />
    );
  }

  if (readOnly) {
    return null;
  }

  return <EmptyFlowEditor dashboard={dashboard} />;
}

/** Renders the flow editor when no rules exist yet. */
function EmptyFlowEditor({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className={styles.wrapper}>
      <ReactFlow
        nodes={[]}
        edges={[]}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <Panel position="top-right">
          {showAddForm ? (
            <AddRuleForm dashboard={dashboard} onClose={() => setShowAddForm(false)} />
          ) : (
            <Button size="sm" icon="plus" variant="primary" onClick={() => setShowAddForm(true)}>
              Add rule
            </Button>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}

const HIGHLIGHT_CLASS = 'dashboard-rule-highlight';

/**
 * Find the DOM element for a target reference so we can highlight it on the canvas.
 * Returns the container HTMLElement or null if not found.
 */
function findTargetDomElement(dashboard: DashboardScene, kind: string, name: string): HTMLElement | null {
  if (kind === 'ElementReference') {
    // Find the VizPanel whose element identifier matches
    const panels = dashboardSceneGraph.getVizPanels(dashboard);
    for (const panel of panels) {
      const elementId = dashboardSceneGraph.getElementIdentifierForVizPanel(panel);
      if (elementId === name) {
        // Walk up the parent chain to find the AutoGridItem that has the containerRef
        try {
          const gridItem = sceneGraph.getAncestor(panel, AutoGridItem);
          if (gridItem.containerRef.current) {
            return gridItem.containerRef.current;
          }
        } catch {
          // Panel may not be inside an AutoGridItem (e.g. SceneGridItem in legacy layouts)
        }
      }
    }
  } else if (kind === 'LayoutItemReference') {
    // Find a RowItem or TabItem by its name
    const match = sceneGraph.findObject(dashboard, (obj) => {
      if (obj instanceof RowItem && obj.state.name === name) {
        return true;
      }
      if (obj instanceof TabItem && obj.state.name === name) {
        return true;
      }
      return false;
    });

    if (match instanceof RowItem && match.containerRef.current) {
      return match.containerRef.current;
    }
    if (match instanceof TabItem && match.containerRef.current) {
      return match.containerRef.current;
    }
  }

  return null;
}

/** State for the form panel: either adding, editing a specific rule, or closed. */
type FormMode = { type: 'closed' } | { type: 'add' } | { type: 'edit'; ruleIndex: number };

/** Renders the flow editor with reactive subscription to DashboardRules state. */
function ReactiveFlowEditor({
  dashboard,
  dashboardRules,
  readOnly,
  simulatedActiveRules,
}: {
  dashboard: DashboardScene;
  dashboardRules: DashboardRules;
  readOnly?: boolean;
  simulatedActiveRules?: Set<number>;
}) {
  const styles = useStyles2(getStyles);
  const [formMode, setFormMode] = useState<FormMode>({ type: 'closed' });

  // Subscribe to rules state changes so the graph rebuilds when rules are added/removed/evaluated.
  // hiddenTargets changes whenever any rule's active state changes, so it triggers a rebuild.
  const { rules, hiddenTargets } = dashboardRules.useState();

  const { flowNodes, flowEdges } = useMemo(
    () => buildFlowFromRules(rules, simulatedActiveRules),
    // hiddenTargets is included because it changes when rule active states change,
    // and buildFlowFromRules reads rule.state.active and condition.state.result directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rules, hiddenTargets, simulatedActiveRules]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync flow state when rules change
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // Double-click on a rule node opens the editor for that rule
  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'ruleNode' && node.data.ruleIndex !== undefined) {
      setFormMode({ type: 'edit', ruleIndex: node.data.ruleIndex as number });
    }
  }, []);

  const closeForm = useCallback(() => setFormMode({ type: 'closed' }), []);

  // Track highlighted element so we can remove the class on leave
  const highlightedRef = useRef<HTMLElement | null>(null);

  const onNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== 'targetNode') {
        return;
      }
      const { kind, name } = node.data as { kind: string; name: string };
      const el = findTargetDomElement(dashboard, kind, name);
      if (el) {
        el.classList.add(HIGHLIGHT_CLASS);
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        highlightedRef.current = el;
      }
    },
    [dashboard]
  );

  const onNodeMouseLeave = useCallback(() => {
    if (highlightedRef.current) {
      highlightedRef.current.classList.remove(HIGHLIGHT_CLASS);
      highlightedRef.current = null;
    }
  }, []);

  // Clean up highlight on unmount
  useEffect(() => {
    return () => {
      if (highlightedRef.current) {
        highlightedRef.current.classList.remove(HIGHLIGHT_CLASS);
      }
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onNodeDoubleClick={readOnly ? undefined : onNodeDoubleClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        {!readOnly && (
          <Panel position="top-right">
            {formMode.type === 'add' && <AddRuleForm dashboard={dashboard} onClose={closeForm} />}
            {formMode.type === 'edit' && (
              <AddRuleForm
                key={`edit-${formMode.ruleIndex}`}
                dashboard={dashboard}
                onClose={closeForm}
                editRuleIndex={formMode.ruleIndex}
              />
            )}
            {formMode.type === 'closed' && (
              <Button size="sm" icon="plus" variant="primary" onClick={() => setFormMode({ type: 'add' })}>
                Add rule
              </Button>
            )}
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

// ─── Layout constants ──────────────────────────────────────────────

/** X position for the rule node */
const RULE_X = 0;
/** X position for targets (same column start as conditions, but in a different Y band) */
const TARGET_X = 280;
/** X position for the first condition */
const COND_START_X = 280;
/** Horizontal spacing between condition nodes (including connector) */
const COND_SPACING_X = 220;
/** Horizontal width of a connector pill between conditions */
const CONNECTOR_WIDTH = 60;

/** Vertical spacing between items stacked vertically */
const ROW_HEIGHT = 56;
/** Vertical gap between the target band and the condition band */
const BAND_GAP = 20;
/** Gap between rule groups */
const RULE_GROUP_GAP = 50;

// ─── Edge colors ───────────────────────────────────────────────────

const EDGE_COLORS = {
  applies: '#FF9900',
  condition: '#6E9FFF',
  connector: '#8B8B8B',
  outcome: '#73BF69',
};

// ─── Build flow graph ──────────────────────────────────────────────

/**
 * Convert DashboardRule[] into React Flow nodes and edges.
 *
 * Two-band layout per rule:
 *   Band 1 (top):    [Rule] ──applies──> [Target 1] [Target 2] ...  (targets stacked vertically)
 *   Band 2 (bottom): [Rule] ──if──> [Cond 1] ─AND─ [Cond 2] ──then──> [Outcome]  (horizontal chain)
 *
 * The rule node spans both bands. Conditions flow left-to-right with small
 * AND/OR connector pills between them. Outcomes sit after the last condition.
 */
function buildFlowFromRules(
  rules: DashboardRule[],
  simulatedActiveRules?: Set<number>
): {
  flowNodes: Node[];
  flowEdges: Edge[];
} {
  if (rules.length === 0) {
    return { flowNodes: [], flowEdges: [] };
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let currentY = 0;

  // When in simulator mode, use the simulated active state instead of live evaluation
  const isSimulating = simulatedActiveRules !== undefined;

  rules.forEach((rule, ruleIdx) => {
    const ruleId = `rule-${ruleIdx}`;
    const isActive = isSimulating ? simulatedActiveRules.has(ruleIdx) : rule.state.active;
    const dimOpacity = isSimulating && !isActive ? 0.25 : 1;

    const targets = rule.state.targets ?? ((rule.state as any).target ? [(rule.state as any).target] : []);
    const targetCount = targets.length;
    const condCount = rule.state.conditions.length;
    const outcomeCount = rule.state.outcomes.length;

    // Band 1 height: targets stacked vertically
    const targetBandHeight = Math.max(targetCount, 1) * ROW_HEIGHT;

    // Band 2 height: conditions are horizontal (single row) + outcomes stacked vertically
    const condBandHeight = Math.max(ROW_HEIGHT, Math.max(outcomeCount, 1) * ROW_HEIGHT);

    const totalGroupHeight = targetBandHeight + BAND_GAP + condBandHeight;

    // Y positions for each band
    const targetBandY = currentY;
    const condBandY = currentY + targetBandHeight + BAND_GAP;

    // Center the rule node vertically across both bands
    const ruleCenterY = currentY + totalGroupHeight / 2 - ROW_HEIGHT;

    // ── Rule node ──
    nodes.push({
      id: ruleId,
      type: 'ruleNode',
      position: { x: RULE_X, y: ruleCenterY },
      style: { opacity: dimOpacity },
      data: {
        label: rule.state.name || `Rule ${ruleIdx + 1}`,
        match: rule.state.match,
        active: isActive,
        ruleIndex: ruleIdx,
        conditionCount: condCount,
        targetCount: targetCount,
      },
    });

    // ── Target nodes (band 1, stacked vertically) ──
    targets.forEach((target: { kind: string; name: string }, targetIdx: number) => {
      const targetId = `${ruleId}-target-${targetIdx}`;
      nodes.push({
        id: targetId,
        type: 'targetNode',
        position: { x: TARGET_X, y: targetBandY + targetIdx * ROW_HEIGHT },
        style: { opacity: dimOpacity },
        data: { kind: target.kind, name: target.name },
      });

      edges.push({
        id: `${ruleId}-to-target-${targetIdx}`,
        source: ruleId,
        sourceHandle: 'targets',
        target: targetId,
        label: targetIdx === 0 ? 'applies' : undefined,
        style: { stroke: EDGE_COLORS.applies, opacity: dimOpacity },
        animated: isActive,
      });
    });

    // ── Condition nodes (band 2, chained horizontally with connector pills) ──
    const condY = condBandY;

    rule.state.conditions.forEach((condition, condIdx) => {
      const condId = `${ruleId}-cond-${condIdx}`;
      const serialized = condition.serialize();
      const condX = COND_START_X + condIdx * COND_SPACING_X;

      nodes.push({
        id: condId,
        type: 'conditionNode',
        position: { x: condX, y: condY },
        style: { opacity: dimOpacity },
        data: {
          kind: serialized.kind,
          spec: serialized.spec,
          result: condition.state.result,
        },
      });

      // First condition connects from the rule node
      if (condIdx === 0) {
        edges.push({
          id: `${ruleId}-to-cond-0`,
          source: ruleId,
          sourceHandle: 'conditions',
          target: condId,
          label: 'if',
          style: { stroke: EDGE_COLORS.condition, opacity: dimOpacity },
        });
      }

      // Add connector pill (AND/OR) between this condition and the next
      if (condIdx < condCount - 1) {
        const connectorId = `${ruleId}-connector-${condIdx}`;
        const connectorX = condX + COND_SPACING_X - CONNECTOR_WIDTH - 10;

        nodes.push({
          id: connectorId,
          type: 'conditionConnectorNode',
          position: { x: connectorX, y: condY + 12 },
          style: { opacity: dimOpacity },
          data: { match: rule.state.match },
        });

        // Condition -> connector
        edges.push({
          id: `${condId}-to-connector`,
          source: condId,
          target: connectorId,
          style: { stroke: EDGE_COLORS.connector, opacity: dimOpacity },
        });

        // Connector -> next condition
        const nextCondId = `${ruleId}-cond-${condIdx + 1}`;
        edges.push({
          id: `connector-${connectorId}-to-next`,
          source: connectorId,
          target: nextCondId,
          style: { stroke: EDGE_COLORS.connector, opacity: dimOpacity },
        });
      }
    });

    // ── Outcome nodes (band 2, after the last condition, stacked vertically) ──
    const outcomeX = COND_START_X + Math.max(condCount, 1) * COND_SPACING_X;
    const outcomeStartY = condBandY + (condBandHeight - Math.max(outcomeCount, 1) * ROW_HEIGHT) / 2;

    rule.state.outcomes.forEach((outcome, outIdx) => {
      const outId = `${ruleId}-outcome-${outIdx}`;
      nodes.push({
        id: outId,
        type: 'outcomeNode',
        position: { x: outcomeX, y: outcomeStartY + outIdx * ROW_HEIGHT },
        style: { opacity: dimOpacity },
        data: { kind: outcome.kind, spec: outcome.spec },
      });

      // Connect last condition to outcome
      const lastCondIdx = condCount - 1;
      if (lastCondIdx >= 0) {
        const lastCondId = `${ruleId}-cond-${lastCondIdx}`;
        edges.push({
          id: `${lastCondId}-to-outcome-${outIdx}`,
          source: lastCondId,
          target: outId,
          label: outIdx === 0 ? 'then' : undefined,
          style: { stroke: EDGE_COLORS.outcome, opacity: dimOpacity },
          animated: isActive,
        });
      }
    });

    currentY += totalGroupHeight + RULE_GROUP_GAP;
  });

  return { flowNodes: nodes, flowEdges: edges };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      flex: 1,
      width: '100%',
      height: '100%',
      minHeight: 0,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',

      // Style the React Flow edge labels to be more subtle
      '.react-flow__edge-textbg': {
        fill: theme.colors.background.primary,
      },
      '.react-flow__edge-text': {
        fill: theme.colors.text.secondary,
        fontSize: '11px',
      },
    }),
  };
}
