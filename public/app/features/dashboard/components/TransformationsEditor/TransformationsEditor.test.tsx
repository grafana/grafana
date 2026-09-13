import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { PanelModel } from '../../state/PanelModel';

import { TransformationsEditor } from './TransformationsEditor';

const setup = (transformations: DataTransformerConfig[] = []) => {
  const panel = new PanelModel({});
  panel.setTransformations(transformations);
  render(<TransformationsEditor panel={panel} />);
};

describe('TransformationsEditor', () => {
  standardTransformersRegistry.setInit(getStandardTransformers);

  describe('when no transformations configured', () => {
    it('renders transformation empty message', () => {
      setup();
      const message = screen.getAllByTestId('data-testid no transformations message');
      expect(message.length).toEqual(1);
    });
  });

  describe('when transformations configured', () => {
    it('renders transformation editors', async () => {
      setup([
        {
          id: 'reduce',
          options: {},
        },
      ]);
      const editors = await screen.findAllByTestId(/Transformation editor/);
      expect(editors).toHaveLength(1);
    });
  });

  describe('when Add transformation clicked', () => {
    it('renders transformations picker', async () => {
      setup([
        {
          id: 'reduce',
          options: {},
        },
      ]);

      const addTransformationButton = screen.getByTestId(selectors.components.Transforms.addTransformationButton);
      await userEvent.click(addTransformationButton);

      const search = screen.getByTestId(selectors.components.Transforms.searchInput);
      expect(search).toBeDefined();
    });

    it('announces search results to screen readers via a live region', async () => {
      setup([
        {
          id: 'reduce',
          options: {},
        },
      ]);

      const addTransformationButton = screen.getByTestId(selectors.components.Transforms.addTransformationButton);
      await userEvent.click(addTransformationButton);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');

      const search = screen.getByTestId(selectors.components.Transforms.searchInput);
      await userEvent.type(search, 'reduce');

      await waitFor(() => expect(status).toHaveTextContent(/\d+ transformations? found/));

      await userEvent.clear(search);
      await userEvent.type(search, 'this matches nothing');

      await waitFor(() => expect(status).toHaveTextContent('No transformations found'));
    });

    it('exposes the picker results as a list so screen readers announce the item count', async () => {
      setup([
        {
          id: 'reduce',
          options: {},
        },
      ]);

      const addTransformationButton = screen.getByTestId(selectors.components.Transforms.addTransformationButton);
      await userEvent.click(addTransformationButton);

      const list = screen.getByRole('list', { name: 'Transformations' });
      expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0);
    });

    it('replaces the results list with an empty state when the search matches nothing', async () => {
      setup([
        {
          id: 'reduce',
          options: {},
        },
      ]);

      const addTransformationButton = screen.getByTestId(selectors.components.Transforms.addTransformationButton);
      await userEvent.click(addTransformationButton);

      const search = screen.getByTestId(selectors.components.Transforms.searchInput);
      await userEvent.type(search, 'this matches nothing');

      expect(screen.queryByRole('list', { name: 'Transformations' })).not.toBeInTheDocument();

      // The live region announces the same message, so look for the visible empty state specifically
      const emptyStateMessage = screen
        .getAllByText('No transformations found')
        .filter((element) => !element.closest('[role="status"]'));
      expect(emptyStateMessage).toHaveLength(1);
    });
  });

  describe('actions', () => {
    describe('debug', () => {
      it('should show/hide debugger', async () => {
        setup([
          {
            id: 'reduce',
            options: {},
          },
        ]);
        const debuggerSelector = selectors.components.TransformTab.transformationEditorDebugger('Reduce');

        expect(screen.queryByTestId(debuggerSelector)).toBeNull();

        const debugButton = screen.getByTestId(selectors.components.QueryEditorRow.actionButton('Debug'));
        await userEvent.click(debugButton);

        expect(screen.getByTestId(debuggerSelector)).toBeInTheDocument();
      });
    });
  });
});
