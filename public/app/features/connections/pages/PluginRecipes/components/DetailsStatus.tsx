import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { useStyles2 } from '@grafana/ui';

import { PluginRecipe } from '../types';

import { Steps } from './Steps';

type Props = {
  recipe: PluginRecipe;
};

export function DetailsStatus({ recipe }: Props): ReactElement {
  const styles = useStyles2(getStyles);

  return (
    <div>
      {/* Steps */}
      <Steps steps={recipe.steps} />
    </div>
  );
}

const getStyles = () => ({
  overview: css``,
});
