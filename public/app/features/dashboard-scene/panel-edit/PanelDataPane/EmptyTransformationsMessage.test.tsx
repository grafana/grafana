import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { EmptyTransformationsMessage, LegacyEmptyTransformationsMessage } from './EmptyTransformationsMessage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
}));

describe('EmptyTransformationsMessage', () => {
  standardTransformersRegistry.setInit(getStandardTransformers);

  const onShowPicker = jest.fn();
  const onGoToQueries = jest.fn();
  const onAddTransformation = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('LegacyEmptyTransformationsMessage', () => {
    it('should render the legacy empty state message', () => {
      render(<LegacyEmptyTransformationsMessage onShowPicker={onShowPicker} />);

      expect(screen.getByText('Start transforming data')).toBeInTheDocument();
      expect(screen.getByText(/Transformations allow data to be changed in various ways/)).toBeInTheDocument();
    });

    it('should call onShowPicker when "Add transformation" button is clicked', async () => {
      const user = userEvent.setup();
      render(<LegacyEmptyTransformationsMessage onShowPicker={onShowPicker} />);

      const button = screen.getByTestId(selectors.components.Transforms.addTransformationButton);
      await user.click(button);

      expect(onShowPicker).toHaveBeenCalledTimes(1);
    });
  });

  describe('EmptyTransformationsMessage', () => {
    it('should render transformation cards when both onGoToQueries and onAddTransformation are provided', () => {
      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
        />
      );

      // Should show SQL transformation card
      expect(screen.getByText('SQL Expressions')).toBeInTheDocument();
      expect(screen.getByText('Organize fields by name')).toBeInTheDocument();
      expect(screen.getByText('Group by')).toBeInTheDocument();
      expect(screen.getByText('Extract fields')).toBeInTheDocument();
      expect(screen.getByText('Filter data by values')).toBeInTheDocument();
    });

    it('should call onShowPicker when "Show more" button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
        />
      );

      const button = screen.getByTestId(selectors.components.Transforms.addTransformationButton);
      await user.click(button);

      expect(onShowPicker).toHaveBeenCalledTimes(1);
    });

    it('should not show SQL transformation card when onGoToQueries is not provided', () => {
      render(<EmptyTransformationsMessage onShowPicker={onShowPicker} onAddTransformation={onAddTransformation} />);

      expect(screen.queryByText('SQL Expressions')).not.toBeInTheDocument();
    });

    it('should not show transformation cards grid when neither onGoToQueries nor onAddTransformation are provided', () => {
      render(<EmptyTransformationsMessage onShowPicker={onShowPicker} />);

      expect(screen.queryByText('SQL Expressions')).not.toBeInTheDocument();

      // But should still show the "Show more" button
      expect(screen.getByTestId(selectors.components.Transforms.addTransformationButton)).toBeInTheDocument();
    });
  });
});
