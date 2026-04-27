import { Tooltip } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';

export function InfoIcon({ text }: { text: string }) {
  return (
    <Tooltip placement="top" content={<div>{text}</div>}>
      <Icon name="info-circle" size="xs" />
    </Tooltip>
  );
}
