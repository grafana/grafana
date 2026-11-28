import { css } from '@emotion/css';
import { useState } from 'react';

import { useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Input, useStyles2 } from '@grafana/ui';

import { assistantContext } from '../assistantContext';
import { EXAMPLE_SERVICE, type Scope } from '../liveScenario';

import { AssistantIcon } from './AssistantIcon';

interface Props {
  // The scope the page is showing, so the question reaches Grafana Assistant with that service's context.
  scope?: Scope;
}

export function DrilldownAskRow({ scope }: Props) {
  const styles = useStyles2(getStyles);
  const { isAvailable, openAssistant } = useAssistant();
  const [question, setQuestion] = useState('');

  if (!isAvailable) {
    return null;
  }

  const onAsk = () => {
    if (!openAssistant || !question.trim()) {
      return;
    }
    openAssistant({
      origin: 'grafana/drilldown-home',
      prompt: question,
      context: assistantContext(scope),
      autoSend: true,
    });
    setQuestion('');
  };

  return (
    <form
      className={styles.row}
      onSubmit={(event) => {
        event.preventDefault();
        onAsk();
      }}
    >
      <AssistantIcon />
      <Input
        className={styles.input}
        placeholder={t(
          'drilldown-real.ask-row.assistant-placeholder',
          'Ask Grafana Assistant, for example: why is {{service}} slow?',
          { service: EXAMPLE_SERVICE }
        )}
        aria-label={t('drilldown-real.ask-row.assistant-label', 'Ask Grafana Assistant')}
        value={question}
        onChange={(event) => setQuestion(event.currentTarget.value)}
      />
      <Button type="submit" icon="comment-alt" disabled={!openAssistant || !question.trim()}>
        {t('drilldown-real.ask-row.ask', 'Ask')}
      </Button>
    </form>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(3, 0),
  }),
  input: css({
    flex: 1,
    minWidth: 0,
  }),
});
