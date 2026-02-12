import { css } from '@emotion/css';
import { Handle, NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

// --- Rule node ---

interface RuleNodeData {
  label: string;
  match: 'and' | 'or';
  [key: string]: unknown;
}

export const RuleNode = memo(({ data }: NodeProps) => {
  const styles = useStyles2(getRuleStyles);
  const { label, match } = data as RuleNodeData;

  return (
    <div className={styles.node}>
      <Handle type="source" position={Position.Right} />
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name="list-ul" />
        <Text variant="bodySmall" weight="bold">
          {label}
        </Text>
        <Badge text={match.toUpperCase()} color="blue" />
      </Stack>
    </div>
  );
});

RuleNode.displayName = 'RuleNode';

function getRuleStyles(theme: GrafanaTheme2) {
  return {
    node: css({
      background: theme.colors.background.secondary,
      border: `2px solid ${theme.colors.primary.border}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1, 2),
      minWidth: 180,
    }),
  };
}

// --- Target node ---

interface TargetNodeData {
  kind: string;
  name: string;
  [key: string]: unknown;
}

export const TargetNode = memo(({ data }: NodeProps) => {
  const styles = useStyles2(getTargetStyles);
  const { kind, name } = data as TargetNodeData;

  const isElement = kind === 'ElementReference';
  const iconName = isElement ? 'graph-bar' : 'list-ul';
  const typeLabel = isElement ? 'Panel' : 'Layout item';

  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Stack direction="column" gap={0.5}>
        <Stack direction="row" gap={1} alignItems="center">
          <Icon name={iconName} />
          <Text variant="bodySmall" weight="bold">
            {typeLabel}
          </Text>
        </Stack>
        <Text variant="bodySmall" color="secondary">
          {name}
        </Text>
      </Stack>
    </div>
  );
});

TargetNode.displayName = 'TargetNode';

function getTargetStyles(theme: GrafanaTheme2) {
  return {
    node: css({
      background: theme.colors.background.secondary,
      border: `2px solid ${theme.colors.warning.border}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1, 2),
      minWidth: 140,
    }),
  };
}

// --- Condition node ---

interface ConditionNodeData {
  kind: string;
  spec: Record<string, unknown>;
  [key: string]: unknown;
}

export const ConditionNode = memo(({ data }: NodeProps) => {
  const styles = useStyles2(getConditionStyles);
  const { kind, spec } = data as ConditionNodeData;

  const conditionLabel = getConditionLabel(kind, spec);

  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Stack direction="column" gap={0.5}>
        <Text variant="bodySmall" weight="bold">
          {getConditionTypeName(kind)}
        </Text>
        <Text variant="bodySmall" color="secondary">
          {conditionLabel}
        </Text>
      </Stack>
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';

function getConditionTypeName(kind: string): string {
  switch (kind) {
    case 'ConditionalRenderingVariable':
      return 'Variable';
    case 'ConditionalRenderingData':
      return 'Query result';
    case 'ConditionalRenderingTimeRangeSize':
      return 'Time range';
    default:
      return kind;
  }
}

function getConditionLabel(kind: string, spec: Record<string, unknown>): string {
  switch (kind) {
    case 'ConditionalRenderingVariable':
      return `${spec.variable} ${spec.operator} ${spec.value}`;
    case 'ConditionalRenderingData':
      return spec.value ? 'Has data' : 'No data';
    case 'ConditionalRenderingTimeRangeSize':
      return `< ${spec.value}`;
    default:
      return JSON.stringify(spec);
  }
}

function getConditionStyles(theme: GrafanaTheme2) {
  return {
    node: css({
      background: theme.colors.background.secondary,
      border: `2px solid ${theme.colors.info.border}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1, 2),
      minWidth: 160,
    }),
  };
}

// --- Outcome node ---

interface OutcomeNodeData {
  kind: string;
  spec: Record<string, unknown>;
  [key: string]: unknown;
}

export const OutcomeNode = memo(({ data }: NodeProps) => {
  const styles = useStyles2(getOutcomeStyles);
  const { kind, spec } = data as OutcomeNodeData;

  const outcomeLabel = getOutcomeLabel(kind, spec);

  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Left} />
      <Stack direction="column" gap={0.5}>
        <Text variant="bodySmall" weight="bold">
          {getOutcomeTypeName(kind)}
        </Text>
        <Text variant="bodySmall" color="secondary">
          {outcomeLabel}
        </Text>
      </Stack>
    </div>
  );
});

OutcomeNode.displayName = 'OutcomeNode';

function getOutcomeTypeName(kind: string): string {
  switch (kind) {
    case 'DashboardRuleOutcomeVisibility':
      return 'Visibility';
    default:
      return kind;
  }
}

function getOutcomeLabel(kind: string, spec: Record<string, unknown>): string {
  switch (kind) {
    case 'DashboardRuleOutcomeVisibility':
      return spec.visibility === 'hide' ? 'Hide element' : 'Show element';
    default:
      return JSON.stringify(spec);
  }
}

function getOutcomeStyles(theme: GrafanaTheme2) {
  return {
    node: css({
      background: theme.colors.background.secondary,
      border: `2px solid ${theme.colors.success.border}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1, 2),
      minWidth: 140,
    }),
  };
}
