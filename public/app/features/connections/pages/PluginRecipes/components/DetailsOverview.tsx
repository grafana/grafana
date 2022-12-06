import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { useStyles2 } from '@grafana/ui';

import { PluginRecipe } from '../types';

type Props = {
  recipe: PluginRecipe;
};

export function DetailsOverview({ recipe }: Props): ReactElement {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.overview}>
      <h2>About</h2>
      <hr />
      {recipe.meta.description}
    </div>
  );
}

const getStyles = () => ({
  overview: css`
    hr {
      margin-top: 12px;
    }
  `,
});
