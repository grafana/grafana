import { __awaiter } from "tslib";
import { rest } from 'msw';
import { setupServer } from 'msw/node';
// bit of setup to mock HTTP request responses
import 'whatwg-fetch';
import { SupportedPlugin } from '../types/pluginBridges';
export const NON_EXISTING_PLUGIN = '__does_not_exist__';
const server = setupServer(rest.get(`/api/plugins/${NON_EXISTING_PLUGIN}/settings`, (_req, res, ctx) => __awaiter(void 0, void 0, void 0, function* () { return res(ctx.status(404)); })), rest.get(`/api/plugins/${SupportedPlugin.Incident}/settings`, (_req, res, ctx) => __awaiter(void 0, void 0, void 0, function* () {
    return res(ctx.json({
        enabled: true,
    }));
})));
export { server };
//# sourceMappingURL=PluginBridge.mock.js.map