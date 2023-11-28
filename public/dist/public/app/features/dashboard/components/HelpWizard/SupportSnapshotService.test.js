import { __awaiter } from "tslib";
import { FieldType, getDefaultTimeRange, LoadingState, toDataFrame } from '@grafana/data';
import { PanelModel } from '../../state/PanelModel';
import { SnapshotTab, SupportSnapshotService } from './SupportSnapshotService';
describe('SupportSnapshotService', () => {
    const panel = new PanelModel({});
    panel.getQueryRunner().setLastResult({
        timeRange: getDefaultTimeRange(),
        state: LoadingState.Done,
        series: [
            toDataFrame({
                name: 'http_requests_total',
                fields: [
                    { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'Value', type: FieldType.number, values: [11, 22, 33] },
                ],
            }),
        ],
    });
    panel.getQueryRunner().resendLastResult();
    it('Can create it with default state', () => {
        const service = new SupportSnapshotService(panel);
        expect(service.state.currentTab).toBe(SnapshotTab.Support);
    });
    it('Can can build support snapshot dashboard', () => __awaiter(void 0, void 0, void 0, function* () {
        const service = new SupportSnapshotService(panel);
        yield service.buildDebugDashboard();
        expect(service.state.snapshot.panels[0].targets[0]).toMatchInlineSnapshot(`
      {
        "datasource": {
          "type": "grafana",
          "uid": "grafana",
        },
        "queryType": "snapshot",
        "refId": "A",
        "snapshot": [
          {
            "data": {
              "values": [
                [
                  1,
                  2,
                  3,
                ],
                [
                  11,
                  22,
                  33,
                ],
              ],
            },
            "schema": {
              "fields": [
                {
                  "config": {},
                  "name": "Time",
                  "type": "time",
                },
                {
                  "config": {},
                  "name": "Value",
                  "type": "number",
                },
              ],
              "meta": undefined,
              "name": "http_requests_total",
              "refId": undefined,
            },
          },
        ],
      }
    `);
    }));
});
//# sourceMappingURL=SupportSnapshotService.test.js.map