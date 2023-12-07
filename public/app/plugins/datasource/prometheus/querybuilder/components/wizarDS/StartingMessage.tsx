import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Checkbox, Stack, useStyles2 } from '@grafana/ui';

import { testIds } from './WizarDS';

type StartingMessageProps = {
  onDontShowChange: () => void;
  onCancel: () => void;
  onContinue: () => void;
  dontShowState: boolean;
};

export const StartingMessage = ({ onDontShowChange, onCancel, onContinue, dontShowState }: StartingMessageProps) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <p>The Query wizard can take you on a journey through the Prometheus UI using AI</p>
      <p>The Query wizard will connect to OpenAI using your API key.</p>
      <p>Check with OpenAI to understand how your data is being used.</p>
      <p>
        The Query wizard information comes from the Grafana documentation and is interpreted by ChatGPT when you enter a
        prompt. Please be aware of the limitations of using LLMs and double check the accuracy of the suggestions.
      </p>

      <div className={styles.actions}>
        <Stack alignItems="center" justifyContent="space-between">
          <Checkbox
            checked={dontShowState}
            value={dontShowState}
            onChange={onDontShowChange}
            label="Don't show this message again"
          />
          <Stack>
            <Button fill="outline" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button fill="solid" variant="primary" onClick={onContinue} data-testid={testIds.securityInfoButton}>
              Continue
            </Button>
          </Stack>
        </Stack>
      </div>
    </>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    actions: css({
      marginTop: theme.spacing(4),
    }),
  };
};
