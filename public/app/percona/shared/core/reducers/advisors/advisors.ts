import { createAsyncThunk } from '@reduxjs/toolkit';
import { CancelToken } from 'axios';

import { createAsyncSlice, withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { AdvisorsService } from 'app/percona/shared/services/advisors/Advisors.service';
import { Advisor } from 'app/percona/shared/services/advisors/Advisors.types';

export const fetchAdvisors = createAsyncThunk(
  'percona/fetchAdvisors',
  (args?: { token?: CancelToken; disableNotifications?: boolean }): Promise<Advisor[]> =>
    withSerializedError(
      (async () => {
        const { advisors } = await AdvisorsService.list(args?.token, args?.disableNotifications);
        return advisors;
      })()
    )
);

const advisorsSlice = createAsyncSlice('perconaAdvisors', fetchAdvisors);

export default advisorsSlice.reducer;
