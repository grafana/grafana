import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { PluginRecipesList } from './components';

export function PluginRecipesPage() {
  return (
    <Page navId={'connections-plugin-recipes'}>
      <Page.Contents>
        <PluginRecipesList />
      </Page.Contents>
    </Page>
  );
}
