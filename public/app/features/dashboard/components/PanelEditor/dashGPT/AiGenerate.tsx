import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Divider, IconButton, TextArea, Toggletip, useStyles2 } from '@grafana/ui';

const QuickFeedbackSuggestions = () => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.quickSuggestionsWrapper}>
      <Button>Even shorter</Button>
      <Button>Improve it</Button>
      <Button>More descriptive</Button>
      <Button>More concise</Button>
    </div>
  );
};

const UserInput = () => {
  const onSubmit = async () => {
    console.log('on submit');
    // const response = await onGeneratePanelWithAI(dashboard!, promptValue);
    // const parsedResponse = JSON.parse(response);
    // const panel = parsedResponse.panels[0];
    // dashboard?.addPanel(panel);
  };

  const styles = useStyles2(getStyles);
  const [assitsDescription, setAssitsDescription] = useState('');
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

interface HistoryItemProps {
  item: string;
  suggestionApply: (suggestion: string) => void;
}

const HistoryItem = ({ item, suggestionApply }: HistoryItemProps) => {
  const styles = useStyles2(getStyles);
  const [isFeedbackSectionOpen, setIsFeedbackSectionOpen] = useState(false);

  const toggleFeedbackSection = () => {
    setIsFeedbackSectionOpen(!isFeedbackSectionOpen);
  };

  return (
    <>
      <div className={styles.historyItems}>
        <div className={styles.item}>{item}</div>
        <div className={styles.buttons}>
          <IconButton
            name="clipboard-alt"
            aria-label="clipboard-alt"
            onClick={() => suggestionApply(item)}
            tooltip="Apply"
          />
          <IconButton
            name="sync"
            aria-label="sync"
            onClick={() => toggleFeedbackSection()}
            tooltip="Provide feedback"
          />
        </div>
      </div>
      {isFeedbackSectionOpen && <QuickFeedbackSuggestions />}
      {isFeedbackSectionOpen && <UserInput />}
      <Divider />
    </>
  );
};
interface Props {
  text: string;
  onClick: () => void;
  history?: string[];
  applySuggestion?: (suggestion: string) => void;
}

export const AiGenerate = ({ text, onClick, history, applySuggestion }: Props) => {
  const styles = useStyles2(getStyles);

  const [shouldClose, setShouldClose] = useState(false);

  const suggestionApply = (suggestion: string) => {
    if (applySuggestion) {
      applySuggestion(suggestion);
      setShouldClose(true);
    }

    setTimeout(() => {
      setShouldClose(false);
    });
  };

  const renderHistory = () => {
    return (
      <div className={styles.history}>
        {history?.map((item, index) => <HistoryItem key={index} item={item} suggestionApply={suggestionApply} />)}
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
  history: css`
    overflow: scroll;
    max-height: 50vh;
  `,
  historyItems: css`
    display: flex;
    padding: 5px 0;
  `,
  buttons: css`
    margin-left: auto;
    align-items: center;
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
