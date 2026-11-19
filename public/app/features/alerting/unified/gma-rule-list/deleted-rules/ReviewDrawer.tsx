import { useState } from 'react';

import { dateTimeFormat } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Collapse, Drawer, Stack, Text } from '@grafana/ui';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import { FolderByUid } from '../folder-browsing/FolderByUid';

import { type DeletedRule } from './types';

interface ReviewDrawerProps {
  rule: DeletedRule;
  deletedByName?: string;
  onClose: () => void;
  onJsonOpen?: () => void;
}

export function ReviewDrawer({ rule, deletedByName, onClose, onJsonOpen }: ReviewDrawerProps) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const title = rule.spec?.title ?? '';
  const deletionTime = rule.metadata?.deletionTimestamp;
  const folderUid = rule.metadata?.annotations?.[AnnoKeyFolder];

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
          {folderUid && <FolderByUid folderUid={folderUid} />}
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
            {JSON.stringify(rule.spec, null, 2)}
          </code>
        </Collapse>
      </Stack>
    </Drawer>
  );
}
