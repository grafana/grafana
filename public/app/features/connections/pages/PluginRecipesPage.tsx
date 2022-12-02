import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { PluginRecipes } from '../tabs/PluginRecipes/PluginRecipes';

export function PluginRecipesPage() {
  return (
    <Page navId={'connections-plugin-recipes'}>
      <Page.Contents>
        <PluginRecipes />
      </Page.Contents>
    </Page>
  );
}
