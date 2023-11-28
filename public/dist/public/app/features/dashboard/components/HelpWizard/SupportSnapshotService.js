import { __awaiter } from "tslib";
import saveAs from 'file-saver';
import { dateTimeFormat, formattedValueToString, getValueFormat } from '@grafana/data';
import { config } from '@grafana/runtime';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import { createDashboardSceneFromDashboardModel } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { getTimeSrv } from '../../services/TimeSrv';
import { DashboardModel } from '../../state';
import { setDashboardToFetchFromLocalStorage } from '../../state/initDashboard';
import { getDebugDashboard, getGithubMarkdown } from './utils';
export var SnapshotTab;
(function (SnapshotTab) {
    SnapshotTab[SnapshotTab["Support"] = 0] = "Support";
    SnapshotTab[SnapshotTab["Data"] = 1] = "Data";
})(SnapshotTab || (SnapshotTab = {}));
export var ShowMessage;
(function (ShowMessage) {
    ShowMessage[ShowMessage["PanelSnapshot"] = 0] = "PanelSnapshot";
    ShowMessage[ShowMessage["GithubComment"] = 1] = "GithubComment";
})(ShowMessage || (ShowMessage = {}));
export class SupportSnapshotService extends StateManagerBase {
    constructor(panel) {
        super({
            panel,
            panelTitle: panel.replaceVariables(panel.title, undefined, 'text') || 'Panel',
            currentTab: SnapshotTab.Support,
            showMessage: ShowMessage.GithubComment,
            snapshotText: '',
            markdownText: '',
            randomize: {},
            snapshotUpdate: 0,
            options: [
                {
                    label: 'GitHub comment',
                    description: 'Copy and paste this message into a GitHub issue or comment',
                    value: ShowMessage.GithubComment,
                },
                {
                    label: 'Panel support snapshot',
                    description: 'Dashboard JSON used to help troubleshoot visualization issues',
                    value: ShowMessage.PanelSnapshot,
                },
            ],
        });
        this.onCurrentTabChange = (value) => {
            this.setState({ currentTab: value });
        };
        this.onShowMessageChange = (value) => {
            this.setState({ showMessage: value.value });
        };
        this.onGetMarkdownForClipboard = () => {
            const { markdownText } = this.state;
            const maxLen = Math.pow(1024, 2) * 1.5; // 1.5MB
            if (markdownText.length > maxLen) {
                this.setState({
                    error: {
                        title: 'Copy to clipboard failed',
                        message: 'Snapshot is too large, consider download and attaching a file instead',
                    },
                });
                return '';
            }
            return markdownText;
        };
        this.onDownloadDashboard = () => {
            const { snapshotText, panelTitle } = this.state;
            const blob = new Blob([snapshotText], {
                type: 'text/plain',
            });
            const fileName = `debug-${panelTitle}-${dateTimeFormat(new Date())}.json.txt`;
            saveAs(blob, fileName);
        };
        this.onSetSnapshotText = (snapshotText) => {
            this.setState({ snapshotText });
        };
        this.onToggleRandomize = (k) => {
            const { randomize } = this.state;
            this.setState({ randomize: Object.assign(Object.assign({}, randomize), { [k]: !randomize[k] }) });
        };
        this.onPreviewDashboard = () => {
            const { snapshot } = this.state;
            if (snapshot) {
                setDashboardToFetchFromLocalStorage({ meta: {}, dashboard: snapshot });
                global.open(config.appUrl + 'dashboard/new', '_blank');
            }
        };
    }
    buildDebugDashboard() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { panel, randomize, snapshotUpdate } = this.state;
            const snapshot = yield getDebugDashboard(panel, randomize, getTimeSrv().timeRange());
            const snapshotText = JSON.stringify(snapshot, null, 2);
            const markdownText = getGithubMarkdown(panel, snapshotText);
            const snapshotSize = formattedValueToString(getValueFormat('bytes')((_a = snapshotText === null || snapshotText === void 0 ? void 0 : snapshotText.length) !== null && _a !== void 0 ? _a : 0));
            let scene = undefined;
            if (!panel.isAngularPlugin()) {
                try {
                    const oldModel = new DashboardModel(snapshot);
                    const dash = createDashboardSceneFromDashboardModel(oldModel);
                    scene = dash.state.body; // skip the wrappers
                }
                catch (ex) {
                    console.log('Error creating scene:', ex);
                }
            }
            this.setState({ snapshot, snapshotText, markdownText, snapshotSize, snapshotUpdate: snapshotUpdate + 1, scene });
        });
    }
}
//# sourceMappingURL=SupportSnapshotService.js.map