import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Drawer, IconButton, ModalsController, Spinner, TextArea, ToolbarButton, useStyles2 } from '@grafana/ui';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { onGeneratePanelWithAI } from '../../utils/dashboard';

export const GeneratePanelButton = () => {
  return (
    <ModalsController key="button-save">
      {({ showModal, hideModal }) => (
        <ToolbarButton
          icon="ai"
          iconOnly={false}
          onClick={() => {
            showModal(GeneratePanelDrawer, { onDismiss: hideModal });
          }}
        >
          Generate Panel
        </ToolbarButton>
      )}
    </ModalsController>
  );
};

interface GeneratePanelDrawerProps {
  onDismiss: () => void;
}
const GeneratePanelDrawer = ({ onDismiss }: GeneratePanelDrawerProps) => {
  const styles = useStyles2(getStyles);

  const [promptValue, setPromptValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dashboard = getDashboardSrv().getCurrent();

  const getContent = () => {
    return (
      <div className={styles.contentWrapper}>
        <p>This assistant can recommend a panel based on the current configuration of this dashboard.</p>

        <p>
          The assistant will connect to OpenAI using your API key. The following information will be sent to OpenAI:
        </p>

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
        <p>Please introduce a description that explains what do you wanna see in your panel</p>
      </div>
    );
  };

  const onInputChange = (value: string) => {
    setPromptValue(value);
  };

  let onSubmitUserInput = async () => {
    setIsLoading(true);
    const response = await onGeneratePanelWithAI(dashboard!, promptValue);
    const parsedResponse = JSON.parse(response);
    const panel = parsedResponse.panels[0];

    if (parsedResponse) {
      setIsLoading(false);
    }

    dashboard?.addPanel(panel);
  };

  return (
    <Drawer title={'Panel Generator'} onClose={onDismiss} scrollableContent>
      {getContent()}
      <div className={styles.wrapper}>
        <TextArea
          placeholder="Tell us something"
          onChange={(e) => onInputChange(e.currentTarget.value)}
          value={promptValue}
          className={styles.textArea}
        />
        {isLoading && <Spinner />}
        {!isLoading && <IconButton name="message" aria-label="message" onClick={onSubmitUserInput} />}
      </div>
    </Drawer>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
  `,
  contentWrapper: css`
    padding-right: 30px;
  `,
  textArea: css`
    margin-right: 24px;
  `,
  list: css`
    padding: 0 0 10px 20px;
  `,
});
