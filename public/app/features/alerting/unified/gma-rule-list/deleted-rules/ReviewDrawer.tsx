import { useState } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { dateTimeFormat } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Collapse, Drawer, Stack, Text } from '@grafana/ui';

interface ReviewDrawerProps {
  rule: AlertRule;
  folderPath: string;
  deletedByName?: string;
  onClose: () => void;
  onJsonOpen?: () => void;
}

function sanitizeForDisplay(rule: AlertRule): object {
  const annotations = Object.fromEntries(
    Object.entries(rule.metadata?.annotations ?? {}).filter(([key]) => !key.startsWith('grafana.com/access/'))
  );
  const sanitized = { ...rule, metadata: { ...rule.metadata, annotations, managedFields: undefined } };
  Reflect.deleteProperty(sanitized, 'status');
  return sanitized;
}

export function ReviewDrawer({ rule, folderPath, deletedByName, onClose, onJsonOpen }: ReviewDrawerProps) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const title = rule.spec?.title ?? '';
  const deletionTime = rule.metadata?.deletionTimestamp;

  const handleJsonToggle = (isOpen: boolean) => {
    setJsonOpen(isOpen);
    if (isOpen) {
      onJsonOpen?.();
    }
  };

  return (
    <Drawer
      title={t('alerting.recently-deleted.review.title', 'Review: {{title}}', {
        title,
        interpolation: { escapeValue: false },
      })}
      onClose={onClose}
      size="md"
    >
      <Stack direction="column" gap={2}>
        <Stack direction="column" gap={0.5}>
          <Text weight="bold">{title}</Text>
          <Text color="secondary">{folderPath}</Text>
          {deletionTime && (
            <Text color="secondary">
              {t('alerting.recently-deleted.review.deleted-at', 'Deleted {{time}}', {
                time: dateTimeFormat(deletionTime),
                interpolation: { escapeValue: false },
              })}
            </Text>
          )}
          {deletedByName && (
            <Text color="secondary">
              {t('alerting.recently-deleted.review.deleted-by', 'By {{name}}', {
                name: deletedByName,
                interpolation: { escapeValue: false },
              })}
            </Text>
          )}
        </Stack>

        <Collapse
          label={t('alerting.recently-deleted.review.advanced', 'Advanced')}
          isOpen={jsonOpen}
          onToggle={handleJsonToggle}
        >
          <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} role="code">
            {JSON.stringify(sanitizeForDisplay(rule), null, 2)}
          </code>
        </Collapse>
      </Stack>
    </Drawer>
  );
}
