import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Button, Field, Stack, TextArea, useStyles2 } from '@grafana/ui';

import { isValidSoftBlockReason } from './utils/softBlock';

interface Props {
  text: string;
  onContinue: (reason: string) => void;
}

export function SoftBlockPrompt({ text, onContinue }: Props) {
  const styles = useStyles2(getStyles);
  const [reason, setReason] = useState('');

  return (
    <Alert severity="warning" title={t('explore.soft-block-prompt.title', 'Query paused by a guardrail')}>
      <Stack direction="column" gap={1} alignItems="flex-start">
        <div className={styles.text}>{text}</div>
        <Field
          label={t('explore.soft-block-prompt.reason-label', 'Reason for continuing')}
          description={t(
            'explore.soft-block-prompt.reason-description',
            'At least 10 characters. The reason is recorded.'
          )}
          noMargin
        >
          <TextArea value={reason} rows={2} onChange={(event) => setReason(event.currentTarget.value)} />
        </Field>
        <Button
          variant="secondary"
          disabled={!isValidSoftBlockReason(reason)}
          onClick={() => onContinue(reason.trim())}
        >
          {t('explore.soft-block-prompt.continue', 'Continue')}
        </Button>
      </Stack>
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  text: css({
    whiteSpace: 'pre-line',
  }),
});
