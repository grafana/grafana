// Overriding the response types when enhancing endpoints is currently fiddly.
// A potential approach could be taken from the below:
// https://github.com/reduxjs/redux-toolkit/issues/3901#issuecomment-1820995408
// https://github.com/reduxjs/redux-toolkit/issues/3443#issue-1709588268
//
// At the time of writing there is an open PR changing the API of `enhanceEndpoints`,
// which may help alleviate this when it lands:
// https://github.com/reduxjs/redux-toolkit/pull/3485

import { generatedTimeIntervalsApi } from 'app/features/alerting/unified/openapi/timeIntervalsApi.gen';

export const timeIntervalsApi = generatedTimeIntervalsApi;
