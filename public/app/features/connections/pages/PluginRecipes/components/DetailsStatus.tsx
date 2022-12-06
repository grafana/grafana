import React, { ReactElement } from 'react';

import { PluginRecipe } from '../types';

type Props = {
  recipe: PluginRecipe;
};

export function DetailsStatus({ recipe }: Props): ReactElement {
  return <div>status</div>;
}
