export default function createMockPanelData(overrides) {
    const _mockPanelData = Object.assign({ state: 'Loading', series: [
            {
                refId: 'A',
                fields: [
                    {
                        name: 'Time',
                        type: 'time',
                        config: { links: Array(1) },
                        values: [],
                        state: null,
                    },
                ],
                length: 360,
            },
        ], annotations: [], request: {
            app: 'dashboard',
            requestId: 'request',
            timezone: 'browser',
            panelId: 1,
            timeInfo: '',
            interval: '20s',
            intervalMs: 20000,
            targets: [],
            maxDataPoints: 100,
            rangeRaw: {
                from: 'now-6h',
                to: 'now',
            },
        }, structureRev: 15 }, overrides);
    const mockPanelData = _mockPanelData;
    return jest.mocked(mockPanelData);
}
//# sourceMappingURL=panelData.js.map