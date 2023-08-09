import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Spinner, TextArea, useStyles2 } from '@grafana/ui';

interface UserPromptProps {
  onSubmitUserInput: (userInput: string) => void;
  isLoading: boolean;
  text?: string;
}

export const UserPrompt = ({ onSubmitUserInput, isLoading, text }: UserPromptProps) => {
  const styles = useStyles2(getStyles);

  const [promptValue, setPromptValue] = useState<string>('');

  const onInputChange = (value: string) => {
    setPromptValue(value);
  };

  return (
    <div>
      {text && <p>{text}</p>}
      <div className={styles.wrapper}>
        <TextArea
          placeholder="Tell us something"
          onChange={(e) => onInputChange(e.currentTarget.value)}
          value={promptValue}
          className={styles.textArea}
        />
        {isLoading && <Spinner />}
        {!isLoading && (
          <IconButton name="message" aria-label="message" onClick={() => onSubmitUserInput(promptValue)} />
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    align-items: center;
  `,
  contentWrapper: css`
    padding-right: 30px;
  `,
  textArea: css`
    margin-right: ${theme.spacing(4)};
  `,
  list: css`
    padding: 0 0 10px 20px;
  `,
});
