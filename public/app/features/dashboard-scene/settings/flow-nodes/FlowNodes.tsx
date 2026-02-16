import { css, cx } from '@emotion/css';
import { Handle, NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

// --- Rule node ---

interface RuleNodeData {
  label: string;
  match: 'and' | 'or';
  active: boolean;
  conditionCount: number;
  targetCount: number;
  [key: string]: unknown;
}

export const RuleNode = memo(({ data }: NodeProps) => {
  const styles = useStyles2(getRuleStyles);
  const { label, match, active, conditionCount, targetCount } = data as RuleNodeData;

  return (
    <Tooltip content="Double-click to edit" placement="top">
      <div className={cx(styles.node, active ? styles.active : styles.inactive)}>
        <Handle type="source" position={Position.Right} id="targets" style={{ top: '30%' }} />
        <Handle type="source" position={Position.Right} id="conditions" style={{ top: '70%' }} />
        <Stack direction="column" gap={0.5}>
          <Stack direction="row" gap={1} alignItems="center">
            <Icon name="list-ul" />
            <Text variant="bodySmall" weight="bold">
              {label}
            </Text>
            <Icon name="pen" size="sm" className={styles.editHint} />
          </Stack>
          <Stack direction="row" gap={1} alignItems="center">
            <Badge text={match.toUpperCase()} color="blue" />
            <Badge text={active ? 'Active' : 'Inactive'} color={active ? 'green' : 'red'} />
          </Stack>
          <Text variant="bodySmall" color="secondary">
            {targetCount} target(s), {conditionCount} condition(s)
          </Text>
        </Stack>
      </div>
    </Tooltip>
  );
});

RuleNode.displayName = 'RuleNode';

function getRuleStyles(theme: GrafanaTheme2) {
  return {
    node: css({
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1, 2),
      minWidth: 200,
      cursor: 'pointer',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }),
    active: css({
      border: `2px solid ${theme.colors.success.border}`,
      boxShadow: `0 0 8px ${theme.colors.success.transparent}`,
    }),
    inactive: css({
      border: `2px solid ${theme.colors.error.border}`,
    }),
    editHint: css({
      color: theme.colors.text.disabled,
      marginLeft: 'auto',
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
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name={iconName} size="sm" />
        <Stack direction="column" gap={0}>
          <Text variant="bodySmall" weight="bold">
            {typeLabel}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {name}
          </Text>
        </Stack>
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
      padding: theme.spacing(0.75, 1.5),
      minWidth: 120,
    }),
  };
}

// --- Condition node ---

interface ConditionNodeData {
  kind: string;
  spec: Record<string, unknown>;
  result: boolean | undefined;
  [key: string]: unknown;
}

export const ConditionNode = memo(({ data }: NodeProps) => {
  const styles = useStyles2(getConditionStyles);
  const { kind, spec, result } = data as ConditionNodeData;

  const conditionLabel = getConditionLabel(kind, spec);
  const resultIcon = result === true ? 'check-circle' : result === false ? 'times-circle' : 'question-circle';
  const resultColor = result === true ? 'success' : result === false ? 'error' : 'secondary';

  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name={resultIcon} size="sm" className={styles[resultColor]} />
        <Stack direction="column" gap={0}>
          <Text variant="bodySmall" weight="bold">
            {getConditionTypeName(kind)}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {conditionLabel}
          </Text>
        </Stack>
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
    case 'ConditionalRenderingUserTeam':
      return 'User team';
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
    case 'ConditionalRenderingUserTeam': {
      const teamUids = spec.teamUids as string[] | undefined;
      const count = teamUids?.length ?? 0;
      const op = spec.operator === 'is_not_member' ? 'not in' : 'in';
      return `${op} ${count} team(s)`;
    }
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
      padding: theme.spacing(0.75, 1.5),
      minWidth: 140,
    }),
    success: css({ color: theme.colors.success.text }),
    error: css({ color: theme.colors.error.text }),
    secondary: css({ color: theme.colors.text.secondary }),
  };
}

// --- Condition connector node (and/or label between vertical conditions) ---

interface ConditionConnectorData {
  match: 'and' | 'or';
  [key: string]: unknown;
}

export const ConditionConnectorNode = memo(({ data }: NodeProps) => {
  const styles = useStyles2(getConnectorStyles);
  const { match } = data as ConditionConnectorData;

  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Text variant="bodySmall" weight="bold" color="secondary">
        {match.toUpperCase()}
      </Text>
    </div>
  );
});

ConditionConnectorNode.displayName = 'ConditionConnectorNode';

function getConnectorStyles(theme: GrafanaTheme2) {
  return {
    node: css({
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.pill,
      padding: theme.spacing(0.25, 1),
      textAlign: 'center' as const,
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
  const iconName = kind === 'DashboardRuleOutcomeVisibility'
    ? (spec.visibility === 'hide' ? 'eye-slash' : 'eye')
    : 'cog';

  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Left} />
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name={iconName} size="sm" />
        <Stack direction="column" gap={0}>
          <Text variant="bodySmall" weight="bold">
            {getOutcomeTypeName(kind)}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {outcomeLabel}
          </Text>
        </Stack>
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
      padding: theme.spacing(0.75, 1.5),
      minWidth: 120,
    }),
  };
}
