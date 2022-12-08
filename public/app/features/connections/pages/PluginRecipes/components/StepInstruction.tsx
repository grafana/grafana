import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { useStyles2 } from '@grafana/ui';

import { InstructionStepSettings, PluginRecipeStep } from '../types';

type Props = {
  step: PluginRecipeStep<InstructionStepSettings>;
};

export function StepInstruction({ step }: Props): ReactElement {
  const styles = useStyles2(getStyles);

  return <div className={styles.container}>Instruction</div>;
}

const getStyles = () => ({
  container: css`
    margin-top: 10px;
  `,
});
