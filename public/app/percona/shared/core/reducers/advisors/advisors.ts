import { createAsyncThunk } from '@reduxjs/toolkit';

import { createAsyncSlice, withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { AdvisorsService } from 'app/percona/shared/services/advisors/Advisors.service';
import { Advisor } from 'app/percona/shared/services/advisors/Advisors.types';

export const fetchAdvisors = createAsyncThunk(
  'percona/fetchAdvisors',
  (): Promise<Advisor[]> =>
    withSerializedError(
      (async () => {
        const { advisors } = await AdvisorsService.list();
        return advisors;
      })()
    )
);

const advisorsSlice = createAsyncSlice('perconaAdvisors', fetchAdvisors);

export default advisorsSlice.reducer;
