import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { useStyles2 } from '@grafana/ui';

import { PluginRecipe, PluginRecipeStep, PromptStepSettings } from '../types';

type Props = {
  recipe: PluginRecipe;
  step: PluginRecipeStep<PromptStepSettings>;
  stepIndex: number;
};

export function StepPrompt({ step }: Props): ReactElement {
  const styles = useStyles2(getStyles);

  return <div className={styles.container}>Prompt</div>;
}

const getStyles = () => ({
  container: css`
    margin-top: 10px;
  `,
});
