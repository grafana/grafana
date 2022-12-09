import { css } from '@emotion/css';
import React, { ReactElement, useState } from 'react';

import { renderMarkdown } from '@grafana/data';
import { useStyles2, Button, HorizontalGroup, Tab, TabsBar, TabContent } from '@grafana/ui';

import { InstructionStepSettings, PluginRecipeStep } from '../types';

type Props = {
  step: PluginRecipeStep<InstructionStepSettings>;
};

export function StepInstruction({ step }: Props): ReactElement {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const styles = useStyles2(getStyles);

  return (
    <>
      {/* Instructions as Markdown */}
      <TabsBar>
        {step.settings.instruction.map((instruction, index) => (
          <Tab
            key={index}
            label={instruction.os}
            active={index === activeTabIndex}
            onChangeTab={() => setActiveTabIndex(index)}
          />
        ))}
      </TabsBar>
      <TabContent>
        <div
          className={styles.container}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(step.settings.instruction[activeTabIndex].markdown) }}
        />
      </TabContent>

      {/* Actions */}
      <div className={styles.buttonGroup}>
        <HorizontalGroup>
          <Button onClick={() => {}} variant="secondary">
            Test
          </Button>

          <Button onClick={() => {}} icon="check">
            Done
          </Button>
        </HorizontalGroup>
      </div>
    </>
  );
}

const getStyles = () => ({
  container: css`
    margin-top: 10px;
    background-color: #ffffff0a;
    padding: 5px 4px;
  `,

  buttonGroup: css`
    margin-top: 20px;
    margin-bottom: 30px;
  `,
});
