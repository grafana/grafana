import { __awaiter } from "tslib";
import { createAsyncThunk } from '@reduxjs/toolkit';
import { createAsyncSlice, withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { AdvisorsService } from 'app/percona/shared/services/advisors/Advisors.service';
export const fetchAdvisors = createAsyncThunk('percona/fetchAdvisors', (args) => withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    const { advisors } = yield AdvisorsService.list(args === null || args === void 0 ? void 0 : args.token, args === null || args === void 0 ? void 0 : args.disableNotifications);
    return advisors;
}))()));
const advisorsSlice = createAsyncSlice('perconaAdvisors', fetchAdvisors);
export default advisorsSlice.reducer;
//# sourceMappingURL=advisors.js.map