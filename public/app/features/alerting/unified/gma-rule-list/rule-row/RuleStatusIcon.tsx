import { Icon, Text, Tooltip } from '@grafana/ui';

import { type RuleStatus } from './ruleStatus';

/**
 * The status icon of the new list. It keeps the old list's colours and tooltips but gives firing, pending and paused
 * their own shapes, because their circles were confused at row size. The old list keeps StateIcon unchanged.
 */
export function RuleStatusIcon({ status }: { status: RuleStatus }) {
  return (
    <Tooltip content={status.label} placement="right">
      <div>
        <Text color={status.color}>
          <Icon name={status.icon} width={ICON_SIZE} height={ICON_SIZE} aria-label={status.label} />
        </Text>
      </div>
    </Tooltip>
  );
}

const ICON_SIZE = 15;
