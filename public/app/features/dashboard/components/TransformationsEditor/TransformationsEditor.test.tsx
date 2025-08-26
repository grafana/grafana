import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import config from 'app/core/config';
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
    it('renders transformation list by default and without transformationsRedesign on', () => {
      setup();
      const cards = screen.getAllByTestId(/New transform/i);
      expect(cards.length).toEqual(standardTransformersRegistry.list().length);
    });

    it('renders transformation empty message with transformationsRedesign feature toggled on', () => {
      config.featureToggles.transformationsRedesign = true;
      setup();
      const message = screen.getAllByTestId('data-testid no transformations message');
      expect(message.length).toEqual(1);
      config.featureToggles.transformationsRedesign = false;
    });
  });

  describe('when transformations configured', () => {
    function renderEditors() {
      setup([
        {
          id: 'reduce',
          options: {},
        },
      ]);
      const editors = screen.getAllByTestId(/Transformation editor/);
      expect(editors).toHaveLength(1);
    }

    it('renders transformation editors', renderEditors);
    it('renders transformation editors with transformationsRedesign feature toggled on', () => {
      config.featureToggles.transformationsRedesign = true;
      renderEditors();
      config.featureToggles.transformationsRedesign = false;
    });
  });

  describe('when Add transformation clicked', () => {
    async function renderPicker() {
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
    }

    it('renders transformations picker', renderPicker);
    it('renders transformation picker with transformationsRedesign feature toggled on', async () => {
      config.featureToggles.transformationsRedesign = true;
      await renderPicker();
      config.featureToggles.transformationsRedesign = false;
    });
  });

  describe('actions', () => {
    describe('debug', () => {
      async function showHideDebugger() {
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
      }

      it('should show/hide debugger', showHideDebugger);
      it('renders transformation editors with transformationsRedesign feature toggled on', async () => {
        config.featureToggles.transformationsRedesign = true;
        await showHideDebugger();
        config.featureToggles.transformationsRedesign = false;
      });
    });
  });
});
