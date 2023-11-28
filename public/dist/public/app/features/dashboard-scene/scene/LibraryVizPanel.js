import { __awaiter } from "tslib";
import React from 'react';
import { SceneObjectBase, VizPanel } from '@grafana/scenes';
import { PanelModel } from 'app/features/dashboard/state';
import { getLibraryPanel } from 'app/features/library-panels/state/api';
import { createPanelDataProvider } from '../utils/createPanelDataProvider';
export class LibraryVizPanel extends SceneObjectBase {
    constructor({ uid, title, key, name }) {
        super({ uid, title, key, name });
        this._onActivate = () => {
            this.loadLibraryPanelFromPanelModel();
        };
        this.addActivationHandler(this._onActivate);
    }
    loadLibraryPanelFromPanelModel() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { title } = this.state;
            let vizPanel = new VizPanel({ title });
            try {
                const libPanel = yield getLibraryPanel(this.state.uid, true);
                const libPanelModel = new PanelModel(libPanel.model);
                vizPanel.setState({
                    options: (_a = libPanelModel.options) !== null && _a !== void 0 ? _a : {},
                    fieldConfig: libPanelModel.fieldConfig,
                    pluginVersion: libPanelModel.pluginVersion,
                    displayMode: libPanelModel.transparent ? 'transparent' : undefined,
                    $data: createPanelDataProvider(libPanelModel),
                });
            }
            catch (err) {
                vizPanel.setState({
                    _pluginLoadError: 'Unable to load library panel: ' + this.state.uid,
                });
            }
            this.setState({ panel: vizPanel });
        });
    }
}
LibraryVizPanel.Component = LibraryPanelRenderer;
function LibraryPanelRenderer({ model }) {
    const { panel } = model.useState();
    if (!panel) {
        return null;
    }
    return React.createElement(panel.Component, { model: panel });
}
//# sourceMappingURL=LibraryVizPanel.js.map