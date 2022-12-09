import { css } from '@emotion/css';
import React, { ReactElement, useState } from 'react';

import { renderMarkdown } from '@grafana/data';
import { useStyles2, Button, HorizontalGroup, Tab, TabsBar, TabContent } from '@grafana/ui';

import { applyStep, useGetSingle } from '../api';
import { InstructionStepSettings, PluginRecipe, PluginRecipeStep } from '../types';
import { installRecipe, isStepCompleted } from '../utils';

type Props = {
  recipe: PluginRecipe;
  step: PluginRecipeStep<InstructionStepSettings>;
  stepIndex: number;
};

export function StepInstruction({ recipe, step, stepIndex }: Props): ReactElement {
  const { refetch } = useGetSingle(recipe.id);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const styles = useStyles2(getStyles);
  const { instruction, instructionTestURL } = step.settings;

  const onDone = async () => {
    await applyStep(recipe.id, stepIndex);
    refetch();
    await installRecipe(recipe, stepIndex + 1);
    refetch();
  };

  return (
    <>
      {/* Instructions as Markdown */}
      <TabsBar>
        {instruction.map((instruction, index) => (
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
          dangerouslySetInnerHTML={{ __html: renderMarkdown(instruction[activeTabIndex].markdown) }}
        />
      </TabContent>

      {/* Actions */}
      <div className={styles.buttonGroup}>
        <HorizontalGroup>
          {instructionTestURL && (
            <Button onClick={() => {}} variant="secondary">
              Test
            </Button>
          )}

          {!isStepCompleted(step) && (
            <Button onClick={onDone} icon="check">
              Done
            </Button>
          )}
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
