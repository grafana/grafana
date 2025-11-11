import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import config from 'app/core/config';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { EmptyTransformationsMessage } from './EmptyTransformationsMessage';

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

    // Set initial feature toggle values
    config.featureToggles = config.featureToggles || {};
    config.featureToggles.transformationsEmptyPlaceholder = false;
    config.featureToggles.sqlExpressions = false;
  });

  describe('Legacy UI (feature toggle disabled)', () => {
    beforeEach(() => {
      config.featureToggles.transformationsEmptyPlaceholder = false;
    });

    it('should render the legacy empty state message', () => {
      render(<EmptyTransformationsMessage onShowPicker={onShowPicker} />);

      expect(screen.getByText('Start transforming data')).toBeInTheDocument();
      expect(screen.getByText(/Transformations allow data to be changed in various ways/)).toBeInTheDocument();
    });

    it('should call onShowPicker when "Add transformation" button is clicked', async () => {
      const user = userEvent.setup();
      render(<EmptyTransformationsMessage onShowPicker={onShowPicker} />);

      const button = screen.getByTestId(selectors.components.Transforms.addTransformationButton);
      await user.click(button);

      expect(onShowPicker).toHaveBeenCalledTimes(1);
    });
  });

  describe('New placeholder UI (feature toggle enabled)', () => {
    beforeEach(() => {
      config.featureToggles.transformationsEmptyPlaceholder = true;
      config.featureToggles.sqlExpressions = true;
    });

    it('should render transformation cards when both onGoToQueries and onAddTransformation are provided', () => {
      render(
        <EmptyTransformationsMessage
          onShowPicker={onShowPicker}
          onGoToQueries={onGoToQueries}
          onAddTransformation={onAddTransformation}
        />
      );

      // Should show SQL transformation card
      expect(screen.getByText('SQL')).toBeInTheDocument();
      expect(screen.getByText('Organize fields by name')).toBeInTheDocument();
      expect(screen.getByText('Group by')).toBeInTheDocument();
      expect(screen.getByText('Extract fields')).toBeInTheDocument();
      expect(screen.getByText('Filter data by values')).toBeInTheDocument();
    });

    it('should not show SQL transformation card when onGoToQueries is not provided', () => {
      render(<EmptyTransformationsMessage onShowPicker={onShowPicker} onAddTransformation={onAddTransformation} />);

      expect(screen.queryByText('SQL')).not.toBeInTheDocument();
    });

    it('should not show transformation cards grid when neither onGoToQueries nor onAddTransformation are provided', () => {
      render(<EmptyTransformationsMessage onShowPicker={onShowPicker} />);

      expect(screen.queryByText('SQL')).not.toBeInTheDocument();

      // But should still show the "See more" button
      expect(screen.getByTestId(selectors.components.Transforms.addTransformationButton)).toBeInTheDocument();
    });
  });
});
