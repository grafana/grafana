import { screen } from '@testing-library/react';

import { createTheme, type DataTransformerInfo, type TransformerRegistryItem } from '@grafana/data';

import { renderWithQueryEditorProvider } from '../testUtils';
import { type Transformation } from '../types';

import { StackedTransformationItem } from './StackedItem';

jest.mock('../TransformationEditorRenderer', () => ({
  TransformationEditorPanel: () => null,
}));

jest.mock('../QueryEditorRenderer', () => ({
  QueryEditorPanel: () => null,
}));

const transformerInfo: DataTransformerInfo = {
  id: 'organize',
  name: 'Organize fields',
  operator: jest.fn(),
};

const registryItem: TransformerRegistryItem = {
  id: 'organize',
  name: 'Organize fields',
  transformation: () => Promise.resolve(transformerInfo),
  editor: () => null,
  imageDark: '',
  imageLight: '',
};

const transformation: Transformation = {
  transformId: 'organize-0',
  transformConfig: { id: 'organize', options: {} },
  registryItem,
};

describe('StackedTransformationItem', () => {
  it('uses the proportional font for the transformation name', () => {
    renderWithQueryEditorProvider(
      <StackedTransformationItem transformation={transformation} headingId="transformation-heading" />,
      { transformations: [transformation], selectedTransformation: transformation }
    );

    expect(getComputedStyle(screen.getByText('Organize fields')).fontFamily.replaceAll(' ', '')).toBe(
      createTheme().typography.fontFamily.replaceAll(' ', '')
    );
  });
});
