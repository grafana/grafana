import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { TransformerRegistryItem } from '@grafana/data';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { TransformationEditorHelperModal } from './TransformationEditorHelperModal';

// Mock the onCloseClick function
const mockOnCloseClick = jest.fn();

const standardTransformers: Array<TransformerRegistryItem<null>> = getStandardTransformers();

const singleTestTransformer: TransformerRegistryItem<null> = standardTransformers[0];

describe('TransformationEditorHelperModal', () => {
  it('renders the modal with the correct title and content', () => {
    // Test each transformer
    standardTransformers.forEach((transformer) => {
      const { unmount } = render(
        <TransformationEditorHelperModal isOpen={true} onCloseClick={mockOnCloseClick} transformer={transformer} />
      );

      // Check if the modal title is rendered with the correct text
      expect(screen.getByText(`Transformation help - ${transformer.transformation.name}`)).toBeInTheDocument();

      // Unmount the component to clean up
      unmount();
    });
  });

  it('calls onCloseClick when the modal is dismissed', () => {
    render(
      <TransformationEditorHelperModal
        isOpen={true}
        onCloseClick={mockOnCloseClick}
        transformer={singleTestTransformer}
      />
    );

    // Find and click the modal's close button
    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);

    // Ensure that the onCloseClick function was called with the correct argument
    expect(mockOnCloseClick).toHaveBeenCalledWith(false);
  });

  it('does not render when isOpen is false', () => {
    render(
      <TransformationEditorHelperModal
        isOpen={false}
        onCloseClick={mockOnCloseClick}
        transformer={singleTestTransformer}
      />
    );

    // Ensure that the modal is not rendered
    expect(screen.queryByText(`Transformation help - ${singleTestTransformer.name}`)).toBeNull();
  });

  it('renders a default message when help content is not provided', () => {
    const transformerWithoutHelp = { ...singleTestTransformer, help: undefined };

    render(
      <TransformationEditorHelperModal
        isOpen={true}
        onCloseClick={mockOnCloseClick}
        transformer={transformerWithoutHelp}
      />
    );

    // Check if the default message is rendered when help content is not provided
    expect(screen.getByText('transformation documentation')).toBeInTheDocument();
  });

  it('renders with custom help content when provided', () => {
    const customHelpContent = 'Custom help content for testing';

    const transformerWithCustomHelp = { ...singleTestTransformer, help: customHelpContent };

    render(
      <TransformationEditorHelperModal
        isOpen={true}
        onCloseClick={mockOnCloseClick}
        transformer={transformerWithCustomHelp}
      />
    );

    // Check if the custom help content is rendered
    expect(screen.getByText(customHelpContent)).toBeInTheDocument();
  });
});
