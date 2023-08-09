import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Divider, IconButton, Spinner, TextArea, Toggletip, useStyles2 } from '@grafana/ui';

// TODO: consider breaking out disparate components into separate files for better readability / maintainability?
interface QuickFeedbackSuggestionsProps {
  item: string;
  isRegenerating: boolean;
  setIsRegenerating: (isRegenerating: boolean) => void;
  llmReGenerate: (
    subject: string,
    originalResponse: string,
    feedback: string,
    historyItemIndex: number
  ) => Promise<boolean>;
  index: number;
  type: string;
}

const QuickFeedbackSuggestions = ({
  item,
  isRegenerating,
  setIsRegenerating,
  llmReGenerate,
  index,
  type,
}: QuickFeedbackSuggestionsProps) => {
  const styles = useStyles2(getStyles);

  const onSuggestionClick = async (suggestion: string) => {
    setIsRegenerating(true);
    const done = await llmReGenerate(type, item, suggestion, index);

    if (done) {
      setIsRegenerating(false);
    }
  };

  return (
    <div className={styles.quickSuggestionsWrapper}>
      <Button onClick={() => onSuggestionClick('Even shorter')} disabled={isRegenerating} size="sm" variant="secondary">
        Even shorter
      </Button>
      <Button onClick={() => onSuggestionClick('Improve it')} disabled={isRegenerating} size="sm" variant="secondary">
        Improve it
      </Button>
      <Button
        onClick={() => onSuggestionClick('More descriptive')}
        disabled={isRegenerating}
        size="sm"
        variant="secondary"
      >
        More descriptive
      </Button>
      <Button onClick={() => onSuggestionClick('More concise')} disabled={isRegenerating} size="sm" variant="secondary">
        More concise
      </Button>
    </div>
  );
};

interface UserInputProps {
  item: string;
  isRegenerating: boolean;
  setIsRegenerating: (isRegenerating: boolean) => void;
  llmReGenerate: (
    subject: string,
    originalResponse: string,
    feedback: string,
    historyItemIndex: number
  ) => Promise<boolean>;
  index: number;
  type: string;
}

const UserInput = ({ item, isRegenerating, setIsRegenerating, llmReGenerate, index, type }: UserInputProps) => {
  const styles = useStyles2(getStyles);
  const [userInput, setUserInput] = useState('');

  const onSubmit = async (feedback: string) => {
    setIsRegenerating(true);
    const done = await llmReGenerate(type, item, feedback, index);

    if (done) {
      setIsRegenerating(false);
      setUserInput('');
    }
  };

  return (
    <div className={styles.userInputWrapper}>
      <TextArea
        className={styles.textArea}
        placeholder="Tell us something"
        onChange={(e) => setUserInput(e.currentTarget.value)}
        value={userInput}
      />
      <IconButton name="message" aria-label="message" onClick={() => onSubmit(userInput)} disabled={isRegenerating} />
    </div>
  );
};

interface HistoryItemProps {
  item: string;
  suggestionApply: (suggestion: string) => void;
  llmReGenerate: (
    subject: string,
    originalResponse: string,
    feedback: string,
    historyItemIndex: number
  ) => Promise<boolean>;
  index: number;
  type: string;
}

const HistoryItem = ({ item, suggestionApply, llmReGenerate, index, type }: HistoryItemProps) => {
  const styles = useStyles2(getStyles);
  const [isFeedbackSectionOpen, setIsFeedbackSectionOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const toggleFeedbackSection = () => {
    setIsFeedbackSectionOpen(!isFeedbackSectionOpen);
  };

  return (
    <>
      <div className={styles.historyItems}>
        <div className={styles.item}>{isRegenerating ? <Spinner /> : item}</div>
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
      {isFeedbackSectionOpen && (
        <QuickFeedbackSuggestions
          item={item}
          isRegenerating={isRegenerating}
          setIsRegenerating={setIsRegenerating}
          llmReGenerate={llmReGenerate}
          index={index}
          type={type}
        />
      )}
      {isFeedbackSectionOpen && (
        <UserInput
          item={item}
          isRegenerating={isRegenerating}
          setIsRegenerating={setIsRegenerating}
          llmReGenerate={llmReGenerate}
          index={index}
          type={type}
        />
      )}
      <Divider />
    </>
  );
};
interface Props {
  text: string;
  onClick: () => void;
  history?: string[];
  applySuggestion?: (suggestion: string) => void;
  llmReGenerate: (
    subject: string,
    originalResponse: string,
    feedback: string,
    historyItemIndex: number
  ) => Promise<boolean>;
  type: string;
  loading?: boolean;
}

export const AiGenerate = ({ text, onClick, history, applySuggestion, llmReGenerate, type, loading }: Props) => {
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
        {history?.map((item, index) => (
          <HistoryItem
            key={index}
            item={item}
            suggestionApply={suggestionApply}
            llmReGenerate={llmReGenerate}
            index={index}
            type={type}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={styles.wrapper}>
      {loading && <Spinner size={14} />}
      <Button icon={!loading ? 'ai' : undefined} onClick={onClick} fill="text" size="sm" disabled={loading}>
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
    gap: 8px;
    padding-top: 10px;
  `,
  userInputWrapper: css`
    margin-top: 20px;
    display: flex;
  `,
  textArea: css`
    margin-right: 24px;
    width: 400px;
  `,
});
