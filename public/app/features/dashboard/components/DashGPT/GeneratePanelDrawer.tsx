import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Drawer, useStyles2 } from '@grafana/ui';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { onGeneratePanelWithAI } from '../../utils/dashboard';

import { UserPrompt } from './UserPrompt';

interface GeneratePanelDrawerProps {
  onDismiss: () => void;
}

export const GeneratePanelDrawer = ({ onDismiss }: GeneratePanelDrawerProps) => {
  const styles = useStyles2(getStyles);

  const dashboard = getDashboardSrv().getCurrent();

  const [isLoading, setIsLoading] = useState<boolean>(false);

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
      </div>
    );
  };

  let onSubmitUserInput = async (promptValue: string) => {
    setIsLoading(true);
    const response = await onGeneratePanelWithAI(dashboard!, promptValue);
    const parsedResponse = JSON.parse(response);
    const panel = parsedResponse?.panels?.[0] || parsedResponse;

    if (parsedResponse) {
      setIsLoading(false);
    }

    dashboard?.addPanel(panel);
  };

  return (
    <Drawer title={'Panel Generator'} onClose={onDismiss} scrollableContent>
      {getContent()}
      <UserPrompt
        onSubmitUserInput={onSubmitUserInput}
        isLoading={isLoading}
        text={'Please introduce a description that explains what do you wanna see in your panel'}
      />
    </Drawer>
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
