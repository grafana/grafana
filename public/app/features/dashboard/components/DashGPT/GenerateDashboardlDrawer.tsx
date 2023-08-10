import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Panel } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { Drawer, useStyles2 } from '@grafana/ui';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { onGenerateDashboardWithAI } from '../../utils/dashboard';

import { QuickActions } from './QuickActions';
import { UserPrompt } from './UserPrompt';

interface GenerateDashboardDrawerProps {
  onDismiss: () => void;
}
export const GenerateDashboardDrawer = ({ onDismiss }: GenerateDashboardDrawerProps) => {
  const styles = useStyles2(getStyles);

  const dashboard = getDashboardSrv().getCurrent();

  const [isLoading, setIsLoading] = useState<boolean>(false);

  let onSubmitUserInput = async (promptValue: string) => {
    setIsLoading(true);
    try {
      const generatedDashboard = await onGenerateDashboardWithAI(promptValue);
      if (generatedDashboard?.panels) {
        setIsLoading(false);
        onDismiss();
        generatedDashboard?.panels.forEach((panel: Panel) => {
          dashboard?.addPanel(panel);
        });
      }
    } catch (err) {
      // @TODO: Show error in the UI
      console.log(err);
    }
  };

  const getContent = () => {
    return (
      <div className={styles.contentWrapper}>
        <p>DashGPT can recommend a dashboard based on the data you will need to see.</p>

        <p>DashGPT will connect to OpenAI using your API key. The following information will be sent to OpenAI:</p>

        <ul className={styles.list}>
          <li>The types of data sources this dashboard is using</li>
          <li>The multiple types of visualization that can be used</li>
        </ul>

        <p>Check with OpenAI to understand how your data is being used.</p>

        <p>
          AI-generated dashboard may not always work correctly or may require further refinement. Always take a moment
          to review the new dashboard.
        </p>
        <p>
          Please provide a description of the dashboard that you need, and we generate it for you, or you can select one
          our data sources demo below:
        </p>
      </div>
    );
  };

  return (
    <Drawer title={'Dashboard Generator'} onClose={onDismiss} scrollableContent>
      {getContent()}
      <QuickActions />
      <UserPrompt onSubmitUserInput={onSubmitUserInput} isLoading={isLoading} />
    </Drawer>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  contentWrapper: css`
    padding-right: 30px;
  `,
  list: css`
    padding: 0 0 10px 20px;
  `,
});
