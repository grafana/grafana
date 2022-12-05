import React, { ReactElement } from 'react';

import { PluginRecipe } from '../types';

type Props = {
  recipe: PluginRecipe;
};

export function DetailsOverview(props: Props): ReactElement {
  const { recipe } = props;
  return <div>{recipe.id}</div>;
}
