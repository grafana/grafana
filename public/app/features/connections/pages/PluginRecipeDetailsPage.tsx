import * as React from 'react';
import type { ReactElement } from 'react';
import { useParams } from 'react-router-dom';

import { useGetSingle } from '../tabs/PluginRecipes/api';

export function PluginRecipeDetailsPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const { status, error, isFetching, data } = useGetSingle(id);

  if (isFetching) {
    return <div>fetching....</div>;
  }

  if (error) {
    return <div>erorr: {String(error)}</div>;
  }

  return (
    <div>
      successfull: {id} / {status}
    </div>
  );
}
