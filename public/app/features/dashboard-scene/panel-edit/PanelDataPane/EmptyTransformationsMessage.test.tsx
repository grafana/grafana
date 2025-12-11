import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import config from 'app/core/config';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { EmptyTransformationsMessage, LegacyEmptyTransformationsMessage } from './EmptyTransformationsMessage';

describe('EmptyTransformationsMessage', () => {
  standardTransformersRegistry.setInit(getStandardTransformers);

  const onShowPicker = jest.fn();
  const onGoToQueries = jest.fn();
  const onAddTransformation = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up feature toggles
    config.featureToggles = config.featureToggles || {};
    config.featureToggles.transformationsEmptyPlaceholder = false;
    config.featureToggles.sqlExpressions = true;
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

  describe('EmptyTransformationsMessage (new UI)', () => {
    beforeEach(() => {
      config.featureToggles.transformationsEmptyPlaceholder = true;
    });

    it('should render SQL expression card and transformation cards when sqlExpressions toggle is enabled', () => {
      config.featureToggles.sqlExpressions = true;

      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
        />
      );

      // Should show SQL transformation card
      expect(screen.getByText('Transform with SQL')).toBeInTheDocument();
      expect(screen.getByText('Organize fields by name')).toBeInTheDocument();
      expect(screen.getByText('Group by')).toBeInTheDocument();
      expect(screen.getByText('Extract fields')).toBeInTheDocument();
      expect(screen.getByText('Filter data by values')).toBeInTheDocument();
    });

    it('should not show SQL expression card when sqlExpressions toggle is disabled', () => {
      config.featureToggles.sqlExpressions = false;

      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
        />
      );

      expect(screen.queryByText('Transform with SQL')).not.toBeInTheDocument();
      // But should still show transformation cards
      expect(screen.getByText('Organize fields by name')).toBeInTheDocument();
    });

    it('should call onGoToQueries when SQL expression card is clicked', async () => {
      config.featureToggles.sqlExpressions = true;
      const user = userEvent.setup();

      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
        />
      );

      const sqlCard = screen.getByTestId('go-to-queries-button');
      const button = sqlCard.querySelector('button');
      await user.click(button!);

      expect(onGoToQueries).toHaveBeenCalledTimes(1);
    });

    it('should not show SQL transformation card when onGoToQueries is not provided', () => {
      render(<EmptyTransformationsMessage onShowPicker={onShowPicker} onAddTransformation={onAddTransformation} />);

      expect(screen.queryByText('Transform with SQL')).not.toBeInTheDocument();
    });

    it('should not show transformation cards grid when neither onGoToQueries nor onAddTransformation are provided', () => {
      render(<EmptyTransformationsMessage onShowPicker={onShowPicker} />);

      expect(screen.queryByText('Transform with SQL')).not.toBeInTheDocument();

      // But should still show the "Show more" button
      expect(screen.getByTestId(selectors.components.Transforms.addTransformationButton)).toBeInTheDocument();
    });
  });
});
