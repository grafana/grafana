import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Button, IconButton, TextArea, Toggletip, useStyles2 } from '@grafana/ui';

interface Props {
  text: string;
  onClick: () => void;
  history?: string[];
  applySuggestion?: (suggestion: string) => void;
}

export const AiGenerate = ({ text, onClick, history, applySuggestion }: Props) => {
  const styles = useStyles2(getStyles);

  const [shouldClose, setShouldClose] = React.useState(false);

  const suggestionApply = (suggestion: string) => {
    if (applySuggestion) {
      applySuggestion(suggestion);
      setShouldClose(true);
    }

    setTimeout(() => {
      setShouldClose(false);
    });
  };

  const retrySuggestion = () => {
    console.log('retrySuggestion');
  };

  const [assitsDescription, setAssitsDescription] = React.useState('');

  const renderQuickSuggestions = () => {
    return (
      <div className={styles.quickSuggestionsWrapper}>
        <Button>Even shorter</Button>
        <Button>Improve it</Button>
        <Button>More descriptive</Button>
        <Button>More concise</Button>
      </div>
    );
  };

  let onSubmit = async () => {
    console.log('on submit');
    // const response = await onGeneratePanelWithAI(dashboard!, promptValue);
    // const parsedResponse = JSON.parse(response);
    // const panel = parsedResponse.panels[0];
    // dashboard?.addPanel(panel);
  };

  const renderUserInput = () => {
    return (
      <div className={styles.userInputWrapper}>
        <TextArea
          className={styles.textArea}
          placeholder="Tell us something"
          width={200}
          onChange={(e) => setAssitsDescription(e.currentTarget.value)}
          value={assitsDescription}
        />
        <IconButton name="message" aria-label="message" onClick={onSubmit} />
      </div>
    );
  };

  const renderHistory = () => {
    return (
      <div className={styles.history}>
        {history?.map((item, index) => {
          return (
            <div key={index} className={styles.historyItems}>
              <div className={styles.item}>{item}</div>
              <div className={styles.buttons}>
                <IconButton name="clipboard-alt" aria-label="clipboard-alt" onClick={() => suggestionApply(item)} />
                <IconButton name="sync" aria-label="sync" onClick={retrySuggestion} />
              </div>
            </div>
          );
        })}

        {history && history.length > 0 && renderQuickSuggestions()}
        {history && history.length > 0 && renderUserInput()}
      </div>
    );
  };

  return (
    <div className={styles.wrapper}>
      <Button icon="ai" onClick={onClick} fill="text" size="sm">
        {text}
      </Button>
      {history && history.length > 0 && history[0] !== '' && (
        <Toggletip content={renderHistory} closeButton={false} placement="bottom-start" shouldClose={shouldClose}>
          <IconButton name="history" aria-label="history" />
        </Toggletip>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
  `,
  history: css``,
  historyItems: css`
    display: flex;
    align-items: flex-start;
    padding: 5px 0;
  `,
  buttons: css`
    align-items: flex-end;
  `,
  item: css`
    margin-right: 10px;
    font-size: ${theme.typography.size.md};
  `,
  quickSuggestionsWrapper: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  `,
  userInputWrapper: css`
    margin-top: 20px;
    display: flex;
  `,
  textArea: css`
    margin-right: 10px;
  `,
});
