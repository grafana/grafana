import React, { useEffect, useState } from 'react';
import { KBarProvider } from 'kbar';
import getGlobalActions from './actions/global.static.actions';
import { CommandPalette } from './CommandPalette';

// action registration needs to be done from within a nested component
export const CommandPaletteContainer = () => {
  return (
    <KBarProvider actions={[]} options={{ enableHistory: true }}>
      <CommandPalette />
    </KBarProvider>
  );
};
