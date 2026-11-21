import { css } from '@emotion/css';
import { useState } from 'react';

import { useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Input, useStyles2 } from '@grafana/ui';

import { AssistantIcon } from './AssistantIcon';

// The input is the only control on this row: scopes are picked from the hints, "Your services",
// or the scope chip once one is set.
export function DrilldownAskRow() {
  const styles = useStyles2(getStyles);
  const { isAvailable, openAssistant } = useAssistant();
  const [question, setQuestion] = useState('');

  const onAsk = () => {
    if (!isAvailable || !openAssistant || !question.trim()) {
      return;
    }
    openAssistant({ origin: 'grafana/drilldown-home', prompt: question, autoSend: true });
    setQuestion('');
  };

  return (
    <div className={styles.row}>
      <Input
        prefix={<AssistantIcon />}
        placeholder={t(
          'drilldown-page.ask-row.assistant-placeholder',
          'Ask Grafana Assistant, for example: why is checkout slow?'
        )}
        aria-label={t('drilldown-page.ask-row.assistant-label', 'Ask Grafana Assistant')}
        value={question}
        disabled={!isAvailable}
        onChange={(event) => setQuestion(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onAsk();
          }
        }}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    padding: theme.spacing(3, 0),
  }),
});
