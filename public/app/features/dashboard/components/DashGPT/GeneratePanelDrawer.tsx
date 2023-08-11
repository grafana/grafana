import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Drawer, IconButton, ModalsController, Spinner, TextArea, useStyles2 } from '@grafana/ui';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { onGeneratePanelWithSemanticSearch } from '../../utils/dashboard';

import { PanelSuggestionsDrawer } from './PanelSuggestionsDrawer';
import { GeneratedPanel, getGeneratedQuickFeedback } from './utils';

interface GeneratePanelDrawerProps {
  onDismiss: () => void;
}

export const GeneratePanelDrawer = ({ onDismiss }: GeneratePanelDrawerProps) => {
  const styles = useStyles2(getStyles);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [promptValue, setPromptValue] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  const getContent = () => {
    return (
      <div className={styles.contentWrapper}>
        <p>DashGPT can recommend a panel based on the current configuration of this dashboard.</p>

        <p>DashGPT will connect to OpenAI using your API key. The following information will be sent to OpenAI:</p>

        <ul className={styles.list}>
          <li>The name and description of this dashboard</li>
          <li>The types of data sources this dashboard is using</li>
          <li>The configuration of any existing panels and sections</li>
        </ul>

        <p>Check with OpenAI to understand how your data is being used.</p>

        <p>
          AI-generated panels may not always work correctly or may require further refinement. Always take a moment to
          review the new panel.
        </p>

        <p>Please introduce a description that explains what do you wanna see in your panel.</p>
      </div>
    );
  };

  let onSubmitUserInput = async (promptValue: string): Promise<GeneratedPanel | null> => {
    setIsLoading(true);
    try {
      const dashboard = getDashboardSrv().getCurrent();

      const enrichedPromptValue = promptValue + ' ' + dashboard?.title ?? '' + ' ' + dashboard?.description ?? '';

      const panels = await onGeneratePanelWithSemanticSearch(enrichedPromptValue);

      // @TODO: Refactor for multiple panels
      const quickFeedbackChoices = await getGeneratedQuickFeedback(panels[0], promptValue);

      setIsLoading(false);

      // @TODO: Refactor for multiple panels
      return { panels: panels, quickFeedback: quickFeedbackChoices };
    } catch (e) {
      setError(true);
      setIsLoading(false);
      setTimeout(function () {
        setError(false);
      }, 3000);
      console.log('error', e);
    }

    return null;
  };

  // @TODO: Refactor to use UserPrompt
  return (
    <Drawer title={'Panel Generator'} onClose={onDismiss} scrollableContent>
      <div className={styles.drawerWrapper}>
        {getContent()}
        {error && <div className={styles.error}>Something went wrong, please try again.</div>}
        <div className={styles.wrapper}>
          <TextArea
            placeholder="Tell us something"
            onChange={(e) => setPromptValue(e.currentTarget.value)}
            value={promptValue}
            className={styles.textArea}
          />
          {isLoading && <Spinner />}
          {!isLoading && (
            <ModalsController>
              {({ showModal, hideModal }) => {
                return (
                  <div>
                    <IconButton
                      name="message"
                      aria-label="message"
                      disabled={!promptValue}
                      onClick={() => {
                        onSubmitUserInput(promptValue).then((response) => {
                          if (response) {
                            showModal(PanelSuggestionsDrawer, {
                              onDismiss: hideModal,
                              suggestions: response.panels,
                              generatedQuickFeedback: response.quickFeedback,
                              userInput: promptValue,
                            });
                          }
                        });
                      }}
                    />
                  </div>
                );
              }}
            </ModalsController>
          )}
        </div>
      </div>
    </Drawer>
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
    display: flex;
    margin-top: auto;
    align-items: center;
  `,
  contentWrapper: css`
    padding-right: 30px;
    margin-bottom: 20px;
  `,
  textArea: css`
    margin-right: ${theme.spacing(4)};
  `,
  list: css`
    padding: 0 0 10px 20px;
  `,
  error: css`
    padding: 10px;
    border: 1px solid ${theme.colors.error.border};
  `,
});
