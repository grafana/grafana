import React from 'react';
import { standardTransformersRegistry } from '@grafana/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransformationsEditor } from './TransformationsEditor';
import { PanelModel } from '../../state';
import { getStandardTransformers } from 'app/core/utils/standardTransformers';
import { selectors } from '@grafana/e2e-selectors';
var setup = function (transformations) {
    if (transformations === void 0) { transformations = []; }
    var panel = new PanelModel({});
    panel.setTransformations(transformations);
    render(React.createElement(TransformationsEditor, { panel: panel }));
};
describe('TransformationsEditor', function () {
    standardTransformersRegistry.setInit(getStandardTransformers);
    describe('when no transformations configured', function () {
        it('renders transformations selection list', function () {
            setup();
            var cards = screen.getAllByLabelText(/^New transform/i);
            expect(cards.length).toEqual(standardTransformersRegistry.list().length);
        });
    });
    describe('when transformations configured', function () {
        it('renders transformation editors', function () {
            setup([
                {
                    id: 'reduce',
                    options: {},
                },
            ]);
            var editors = screen.getAllByLabelText(/^Transformation editor/g);
            expect(editors).toHaveLength(1);
        });
    });
    describe('when Add transformation clicked', function () {
        it('renders transformations picker', function () {
            var buttonLabel = 'Add transformation';
            setup([
                {
                    id: 'reduce',
                    options: {},
                },
            ]);
            var addTransformationButton = screen.getByText(buttonLabel);
            userEvent.click(addTransformationButton);
            var search = screen.getByLabelText(selectors.components.Transforms.searchInput);
            expect(search).toBeDefined();
        });
    });
    describe('actions', function () {
        describe('debug', function () {
            it('should show/hide debugger', function () {
                setup([
                    {
                        id: 'reduce',
                        options: {},
                    },
                ]);
                var debuggerSelector = selectors.components.TransformTab.transformationEditorDebugger('Reduce');
                expect(screen.queryByLabelText(debuggerSelector)).toBeNull();
                var debugButton = screen.getByLabelText(selectors.components.QueryEditorRow.actionButton('Debug'));
                userEvent.click(debugButton);
                expect(screen.getByLabelText(debuggerSelector)).toBeInTheDocument();
            });
        });
    });
});
//# sourceMappingURL=TransformationsEditor.test.js.map