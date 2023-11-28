import { __awaiter } from "tslib";
import { dataFrameToJSON } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { GRAFANA_DATASOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import * as DFImport from 'app/features/dataframe-import';
import { ShowConfirmModalEvent } from 'app/types/events';
import { defaultFileUploadQuery, GrafanaQueryType } from './types';
/**
 * Will show a confirm modal if the current panel does not have a snapshot query.
 * If the confirm modal is shown, and the user aborts the promise will resolve with a false value,
 * otherwise it will resolve with a true value.
 */
export function onUpdatePanelSnapshotData(panel, frames) {
    return new Promise((resolve) => {
        var _a;
        if (((_a = panel.datasource) === null || _a === void 0 ? void 0 : _a.uid) === GRAFANA_DATASOURCE_NAME) {
            updateSnapshotData(frames, panel);
            resolve(true);
            return;
        }
        appEvents.publish(new ShowConfirmModalEvent({
            title: 'Change to panel embedded data',
            text: 'If you want to change the data shown in this panel Grafana will need to remove the panels current query and replace it with a snapshot of the current data. This enables you to edit the data.',
            yesText: 'Continue',
            icon: 'pen',
            onConfirm: () => {
                updateSnapshotData(frames, panel);
                resolve(true);
            },
            onDismiss: () => {
                resolve(false);
            },
        }));
    });
}
function updateSnapshotData(frames, panel) {
    const snapshot = frames.map((f) => dataFrameToJSON(f));
    const query = {
        refId: 'A',
        queryType: GrafanaQueryType.Snapshot,
        snapshot,
        datasource: { uid: GRAFANA_DATASOURCE_NAME },
    };
    panel.updateQueries({
        dataSource: { uid: GRAFANA_DATASOURCE_NAME },
        queries: [query],
    });
    panel.refresh();
}
export function getFileDropToQueryHandler(onFileLoaded) {
    return (acceptedFiles, fileRejections, event) => {
        DFImport.filesToDataframes(acceptedFiles).subscribe((next) => __awaiter(this, void 0, void 0, function* () {
            const snapshot = [];
            next.dataFrames.forEach((df) => {
                const dataframeJson = dataFrameToJSON(df);
                snapshot.push(dataframeJson);
            });
            onFileLoaded(Object.assign(Object.assign({}, defaultFileUploadQuery), { snapshot: snapshot, file: next.file }), fileRejections);
        }));
    };
}
//# sourceMappingURL=utils.js.map