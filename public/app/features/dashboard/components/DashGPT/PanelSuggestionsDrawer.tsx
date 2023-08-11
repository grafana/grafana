import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Drawer, Icon, useStyles2 } from '@grafana/ui';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { PanelModel } from '../../state';
import { onGeneratePanelWithAI, onRegeneratePanelWithFeedback } from '../../utils/dashboard';

import { PanelSuggestions } from './PanelSuggestions';
import { SkeletonPlaceholder } from './SkeletonPlaceholder';
import { UserPrompt } from './UserPrompt';
import { getGeneratedQuickFeedback } from './utils';

interface PanelSuggestionsDrawerProps {
  onDismiss: () => void;
  suggestions: PanelModel[];
  userInput: string;
  generatedQuickFeedback: string[];
}

const panelPlaceholderStyle: React.CSSProperties = {
  height: '200px',
  border: '1px solid rgba(204, 204, 220, 0.12)',
  borderRadius: '2px',
};

const timeRangePlaceholderStyle: React.CSSProperties = {
  height: '32px',
  width: '190px',
  border: '1px solid rgba(204, 204, 220, 0.12)',
  borderRadius: '2px',
};

// @TODO
const timeRangePlaceholder2Style: React.CSSProperties = {
  height: '32px',
  width: '70px',
  border: '1px solid rgba(204, 204, 220, 0.12)',
  borderRadius: '2px',
};

export const PanelSuggestionsDrawer = ({
  onDismiss,
  suggestions,
  userInput,
  generatedQuickFeedback,
}: PanelSuggestionsDrawerProps) => {
  const styles = useStyles2(getStyles);

  const dashboard = getDashboardSrv().getCurrent();

  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userInputValue, setUserInputValue] = useState<string>('');

  useEffect(() => {
    setUserInputValue(userInput);
  }, [userInput]);

  let onGeneratePanel = async (promptValue: string) => {
    setIsRegenerating(true);
    setUserInputValue(promptValue);

    try {
      const response = await onGeneratePanelWithAI(dashboard!, promptValue);
      const parsedResponse = JSON.parse(response);
      const panel = parsedResponse?.panels?.[0] || (parsedResponse as PanelModel);

      generatedQuickFeedback = await getGeneratedQuickFeedback(panel, promptValue);
      setIsRegenerating(false);

      suggestions = [panel];
    } catch (error: any) {
      setError(error?.message || 'Something went wrong, please try again.');
      setTimeout(function () {
        setError(null);
      }, 6000);
    }
    setIsRegenerating(false);
  };

  // @TODO refactor reused code
  // @TODO Refactor to support multiple panels
  // @TODO Error handling
  const onSendFeedback = async (feedback: string) => {
    setIsRegenerating(true);
    try {
      const response = await onRegeneratePanelWithFeedback(dashboard!, feedback, suggestions, userInputValue);
      const parsedResponse = JSON.parse(response);
      const panel = parsedResponse?.panels?.[0] || (parsedResponse as PanelModel);

      generatedQuickFeedback = await getGeneratedQuickFeedback(panel, userInputValue);
      setIsRegenerating(false);

      suggestions = [panel];
    } catch (error: any) {
      setError(error?.message || 'Something went wrong, please try again.');
      setTimeout(function () {
        setError(null);
      }, 6000);
    }
    setIsRegenerating(false);
  };

  // @TODO Move quick feedback and prompt at the bottom
  // @TODO Add better loading feedback, maybe Grot?
  // @TODO Maybe scroll for suggestions?
  return (
    <Drawer title={'Panel Generator'} onClose={onDismiss} scrollableContent>
      <div className={styles.drawerWrapper}>
        <div className={styles.userInput}>
          <Icon name="comment-alt-message" /> {userInputValue}
        </div>
        {isRegenerating && (
          <>
            <div className={styles.timeRangeSkeleton}>
              <SkeletonPlaceholder style={timeRangePlaceholderStyle} />
              <SkeletonPlaceholder style={timeRangePlaceholder2Style} />
            </div>
            <SkeletonPlaceholder style={panelPlaceholderStyle} />
          </>
        )}
        {!isRegenerating && <PanelSuggestions suggestions={suggestions} onDismiss={onDismiss} />}
        <div className={styles.wrapper}>
          {!!error && <div className={styles.error}>{error}</div>}
          <QuickFeedback
            onSendFeedback={onSendFeedback}
            generatedQuickFeedback={generatedQuickFeedback}
            isDisabled={isRegenerating}
          />
          <UserPrompt onSubmitUserInput={onGeneratePanel} isLoading={isRegenerating} />
        </div>
      </div>
    </Drawer>
  );
};

interface QuickFeedbackProps {
  onSendFeedback: (feedback: string) => Promise<void>;
  generatedQuickFeedback: string[];
  isDisabled: boolean;
}

const QuickFeedback = ({ onSendFeedback, generatedQuickFeedback, isDisabled }: QuickFeedbackProps) => {
  const styles = useStyles2(getStyles);

  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  const onFeedbackClick = async (feedback: string) => {
    setIsRegenerating(true);
    onSendFeedback(feedback).then(() => setIsRegenerating(false));
  };

  return (
    <div className={styles.quickFeedbackWrapper}>
      {generatedQuickFeedback.map((feedback, index) => (
        <Button
          onClick={() => onFeedbackClick(feedback)}
          disabled={isRegenerating || isDisabled}
          size="md"
          variant="secondary"
          fill="outline"
          key={index}
        >
          {feedback}
        </Button>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  drawerWrapper: css`
    display: flex;
    flex-direction: column;

    height: 100%;
    padding: 20px;
  `,
  wrapper: css`
    margin-top: auto;
    padding-bottom: 5px;
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
  quickFeedbackWrapper: css`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 16px;
    padding-bottom: 16px;
  `,
  error: css`
    padding: 10px;
    border: 1px solid ${theme.colors.error.border};
    margin: 20px 0;
  `,
  spinner: css`
    display: flex;
    justify-content: center;
    align-content: center;
    padding-top: 30px;
  `,
  userInput: css`
    top: 8px;
    padding-bottom: 16px;
  `,
  timeRangeSkeleton: css`
    display: flex;
    flex-direction: row;
    gap: 8px;
    margin-top: 17px;
    margin-bottom: 15px;
  `,
});
