import { css } from '@emotion/css';
import { type KeyboardEvent, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Input, Modal, Text, useStyles2 } from '@grafana/ui';

interface Props {
  /** Receives the prompt as typed; the modal composes the request and hands it off. */
  onSubmitPrompt: (prompt: string) => void;
  /** Cancel closes the modal. */
  onDismiss: () => void;
}

/**
 * The modal's body: describe the dashboard, then hand off to the sidebar.
 * The question itself is the modal's title, so this only carries the subtext.
 *
 * The input is ours rather than the SDK's `AssistantPromptCardView` because the
 * card keeps the typed prompt in its own state and only surfaces it on its
 * internal submit — a button in the modal's footer could never read it.
 */
export function PromptForm({ onSubmitPrompt, onDismiss }: Props) {
  const styles = useStyles2(getStyles);
  const [prompt, setPrompt] = useState('');
  const trimmedPrompt = prompt.trim();

  const submit = () => {
    if (!trimmedPrompt) {
      return;
    }
    onSubmitPrompt(trimmedPrompt);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.container}>
      <Text color="secondary">
        {t(
          'dashboard-prompt.prompt.description',
          'Describe it in your own words — mention the services, data, or questions you care about.'
        )}
      </Text>

      <Input
        // The modal leaves focus to us (`initialFocus={-1}`), so the user can
        // start typing straight away instead of tabbing off the close button.
        autoFocus
        value={prompt}
        onChange={(event) => setPrompt(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder={t(
          'dashboard-prompt.prompt.placeholder',
          'e.g. Error rates and latency for my checkout service, broken down by environment'
        )}
        aria-label={t('dashboard-prompt.prompt.input-label', 'Describe the dashboard you want')}
        data-testid="dashboard-prompt-input"
      />

      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          <Trans i18nKey="dashboard-prompt.prompt.cancel">Cancel</Trans>
        </Button>
        {/* Hands off to the assistant, which plans first and builds once the
            plan is accepted — the wording the plan card's own button uses. */}
        <Button icon="ai-sparkle" onClick={submit} disabled={!trimmedPrompt}>
          <Trans i18nKey="dashboard-prompt.prompt.submit">Build it</Trans>
        </Button>
      </Modal.ButtonRow>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
  };
}
