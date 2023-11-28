import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import config from 'app/core/config';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';
import { PanelModel } from '../../state';
import { TransformationsEditor } from './TransformationsEditor';
const setup = (transformations = []) => {
    const panel = new PanelModel({});
    panel.setTransformations(transformations);
    render(React.createElement(TransformationsEditor, { panel: panel }));
};
describe('TransformationsEditor', () => {
    standardTransformersRegistry.setInit(getStandardTransformers);
    describe('when no transformations configured', () => {
        function renderList() {
            setup();
            const cards = screen.getAllByTestId(/New transform/i);
            expect(cards.length).toEqual(standardTransformersRegistry.list().length);
        }
        it('renders transformations selection list', renderList);
        it('renders transformations selection list with transformationsRedesign feature toggled on', () => {
            config.featureToggles.transformationsRedesign = true;
            renderList();
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
        function renderPicker() {
            return __awaiter(this, void 0, void 0, function* () {
                setup([
                    {
                        id: 'reduce',
                        options: {},
                    },
                ]);
                const addTransformationButton = screen.getByTestId(selectors.components.Transforms.addTransformationButton);
                yield userEvent.click(addTransformationButton);
                const search = screen.getByTestId(selectors.components.Transforms.searchInput);
                expect(search).toBeDefined();
            });
        }
        it('renders transformations picker', renderPicker);
        it('renders transformation picker with transformationsRedesign feature toggled on', () => __awaiter(void 0, void 0, void 0, function* () {
            config.featureToggles.transformationsRedesign = true;
            yield renderPicker();
            config.featureToggles.transformationsRedesign = false;
        }));
    });
    describe('actions', () => {
        describe('debug', () => {
            function showHideDebugger() {
                return __awaiter(this, void 0, void 0, function* () {
                    setup([
                        {
                            id: 'reduce',
                            options: {},
                        },
                    ]);
                    const debuggerSelector = selectors.components.TransformTab.transformationEditorDebugger('Reduce');
                    expect(screen.queryByTestId(debuggerSelector)).toBeNull();
                    const debugButton = screen.getByLabelText(selectors.components.QueryEditorRow.actionButton('Debug'));
                    yield userEvent.click(debugButton);
                    expect(screen.getByTestId(debuggerSelector)).toBeInTheDocument();
                });
            }
            it('should show/hide debugger', showHideDebugger);
            it('renders transformation editors with transformationsRedesign feature toggled on', () => __awaiter(void 0, void 0, void 0, function* () {
                config.featureToggles.transformationsRedesign = true;
                yield showHideDebugger();
                config.featureToggles.transformationsRedesign = false;
            }));
        });
    });
});
//# sourceMappingURL=TransformationsEditor.test.js.map