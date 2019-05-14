import { PanelDataFormat } from 'app/types';
export var getMockPlugins = function (amount) {
    var plugins = [];
    for (var i = 0; i <= amount; i++) {
        plugins.push({
            defaultNavUrl: 'some/url',
            enabled: false,
            hasUpdate: false,
            id: "" + i,
            info: {
                author: {
                    name: 'Grafana Labs',
                    url: 'url/to/GrafanaLabs',
                },
                description: 'pretty decent plugin',
                links: ['one link'],
                logos: { small: 'small/logo', large: 'large/logo' },
                screenshots: [{ path: "screenshot/" + i }],
                updated: '2018-09-26',
                version: '1',
            },
            latestVersion: "1." + i,
            name: "pretty cool plugin-" + i,
            pinned: false,
            state: '',
            type: '',
            module: {},
        });
    }
    return plugins;
};
export var getPanelPlugin = function (options) {
    return {
        id: options.id,
        name: options.id,
        sort: options.sort || 1,
        dataFormats: [PanelDataFormat.TimeSeries],
        info: {
            author: {
                name: options.id + 'name',
            },
            description: '',
            links: [],
            logos: {
                large: '',
                small: '',
            },
            screenshots: [],
            updated: '',
            version: '',
        },
        hideFromList: options.hideFromList === true,
        module: '',
        baseUrl: '',
    };
};
export var getMockPlugin = function () {
    return {
        defaultNavUrl: 'some/url',
        enabled: false,
        hasUpdate: false,
        id: '1',
        info: {
            author: {
                name: 'Grafana Labs',
                url: 'url/to/GrafanaLabs',
            },
            description: 'pretty decent plugin',
            links: [{ name: 'project', url: 'one link' }],
            logos: { small: 'small/logo', large: 'large/logo' },
            screenshots: [{ path: "screenshot" }],
            updated: '2018-09-26',
            version: '1',
        },
        latestVersion: '1',
        name: 'pretty cool plugin 1',
        pinned: false,
        state: '',
        type: '',
        module: {},
    };
};
//# sourceMappingURL=pluginMocks.js.map