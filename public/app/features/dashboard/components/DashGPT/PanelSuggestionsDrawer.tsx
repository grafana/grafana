import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Drawer, useStyles2 } from '@grafana/ui';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { PanelModel } from '../../state';
import { onGeneratePanelWithAI, onRegeneratePanelWithFeedback } from '../../utils/dashboard';

import { PanelSuggestions } from './PanelSuggestions';
import { UserPrompt } from './UserPrompt';
import { getGeneratedQuickFeedback } from './utils';

interface PanelSuggestionsDrawerProps {
  onDismiss: () => void;
  suggestions: PanelModel[];
  userInput: string;
  generatedQuickFeedback: string[];
}

export const PanelSuggestionsDrawer = ({
  onDismiss,
  suggestions,
  userInput,
  generatedQuickFeedback,
}: PanelSuggestionsDrawerProps) => {
  const styles = useStyles2(getStyles);

  const dashboard = getDashboardSrv().getCurrent();

  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  let onSubmitUserInput = async (promptValue: string) => {
    setIsRegenerating(true);
    const response = await onGeneratePanelWithAI(dashboard!, promptValue);
    const parsedResponse = JSON.parse(response);
    const panel = parsedResponse?.panels?.[0] || (parsedResponse as PanelModel);

    generatedQuickFeedback = await getGeneratedQuickFeedback(panel, promptValue);
    setIsRegenerating(false);
    suggestions = [panel];
  };

  // @TODO refactor reused code
  // @TODO Force type to PanelModel
  // @TODO Refactor to support multiple panels
  const onSendFeedback = async (feedback: string) => {
    setIsRegenerating(true);
    try {
      const response = await onRegeneratePanelWithFeedback(dashboard!, feedback, suggestions, userInput);
      const parsedResponse = JSON.parse(response);
      const panel = parsedResponse?.panels?.[0] || (parsedResponse as PanelModel);

      generatedQuickFeedback = await getGeneratedQuickFeedback(panel, userInput);
      setIsRegenerating(false);

      suggestions = [panel];
    } catch (e) {
      setIsError(true);
      setIsRegenerating(false);
      setTimeout(function () {
        setIsError(false);
      }, 3000);
      console.log('error', e);
    }
  };

  return (
    <Drawer title={'Panel Generator'} onClose={onDismiss} scrollableContent>
      <div className={styles.drawerWrapper}>
        <UserPrompt
          onSubmitUserInput={onSubmitUserInput}
          isLoading={isRegenerating}
          text={'Please introduce a description that explains what do you wanna see in your panel'}
          value={userInput}
        />
        {/*{isRegenerating && <div className={styles.spinner}><Spinner size={24}/></div>}*/}
        {!isRegenerating && (
          <div>
            <PanelSuggestions suggestions={suggestions} onDismiss={onDismiss} />
            <QuickFeedback onSendFeedback={onSendFeedback} generatedQuickFeedback={generatedQuickFeedback} />
          </div>
        )}
        {isError && <div className={styles.error}>Something went wrong, please try again.</div>}
      </div>
    </Drawer>
  );
};

interface QuickFeedbackProps {
  onSendFeedback: (feedback: string) => Promise<void>;
  generatedQuickFeedback: string[];
}

const QuickFeedback = ({ onSendFeedback, generatedQuickFeedback }: QuickFeedbackProps) => {
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
          disabled={isRegenerating}
          size="md"
          variant="secondary"
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
    padding: 20px;
  `,
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
  quickFeedbackWrapper: css`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 10px;
  `,
  error: css`
    padding: 10px;
    border: 1px solid ${theme.colors.error.border};
  `,
  spinner: css`
    display: flex;
    justify-content: center;
    align-content: center;
    padding-top: 30px;
  `,
});
