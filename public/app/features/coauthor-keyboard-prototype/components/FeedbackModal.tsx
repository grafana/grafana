import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Modal, TextArea, useStyles2 } from '@grafana/ui';

interface Props {
  kind: 'up' | 'down';
  onDismiss: () => void;
  onSubmit: () => void;
}

/** Centered follow-up asked after a thumb is clicked on a suggestion. */
export function FeedbackModal({ kind, onDismiss, onSubmit }: Props) {
  const styles = useStyles2(getStyles);
  const [text, setText] = useState('');
  return (
    <Modal
      title={kind === 'up' ? 'What worked well?' : 'What went wrong?'}
      isOpen
      onDismiss={onDismiss}
      className={styles.modal}
    >
      <p className={styles.intro}>
        {kind === 'up'
          ? 'Thanks — tell us what made this suggestion useful so we can keep it that way.'
          : 'Thanks — tell us what was off about this suggestion so we can improve it.'}
      </p>
      <TextArea
        rows={4}
        autoFocus
        value={text}
        placeholder={kind === 'up' ? 'This did exactly what I meant by…' : 'I expected it to…'}
        onChange={(e) => setText(e.currentTarget.value)}
      />
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>Send feedback</Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({ width: 520 }),
  intro: css({ color: theme.colors.text.secondary, fontSize: theme.typography.body.fontSize }),
});
