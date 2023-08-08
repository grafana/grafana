import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Drawer, IconButton, ModalsController, TextArea, ToolbarButton, useStyles2 } from '@grafana/ui';

export const GeneratePanelButton = () => {
  return (
    <ModalsController key="button-save">
      {({ showModal, hideModal }) => (
        <ToolbarButton
          icon="grafana"
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

  const getContent = () => {
    return (
      <div>
        <p>This assistant can recommend a panel based on the current configuration of this dashboard.</p>

        <p>
          The assistant will connect to OpenAI using your API key. The following information will be sent to OpenAI:
        </p>

        <ul>
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
    console.log('onInputChange', value);
    setPromptValue(value);
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
        <IconButton name="message" aria-label="message" />
      </div>
    </Drawer>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
  `,
  textArea: css`
    margin-right: 10px;
  `,
});
