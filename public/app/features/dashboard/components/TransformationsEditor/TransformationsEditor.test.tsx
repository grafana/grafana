import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';
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
    it('renders transformation editors', () => {
      setup([
        {
          id: 'reduce',
          options: {},
        },
      ]);
      const editors = screen.getAllByTestId(/Transformation editor/);
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
