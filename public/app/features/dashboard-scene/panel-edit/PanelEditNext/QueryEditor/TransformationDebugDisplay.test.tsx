import { screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';

import { TransformationDebugDisplay } from './TransformationDebugDisplay';
import { mockTransformToggles, renderWithQueryEditorProvider } from './testUtils';
import { type Transformation } from './types';

const transformation: Transformation = {
  transformId: 'reduce-0',
  transformConfig: { id: 'reduce', options: {} },
  registryItem: undefined,
};

describe('TransformationDebugDisplay', () => {
  it('uses the proportional font for its section labels', () => {
    renderWithQueryEditorProvider(<TransformationDebugDisplay />, {
      transformations: [transformation],
      selectedTransformation: transformation,
      uiStateOverrides: {
        transformToggles: { ...mockTransformToggles, showDebug: true },
      },
    });

    const expectedFont = createTheme().typography.fontFamily.replaceAll(' ', '');
    expect(getComputedStyle(screen.getByText('Input data')).fontFamily.replaceAll(' ', '')).toBe(expectedFont);
    expect(getComputedStyle(screen.getByText('Output data')).fontFamily.replaceAll(' ', '')).toBe(expectedFont);
  });
});
