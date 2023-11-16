import { INT_32 } from '../../core';

import { lessThan, greaterThan } from '.';

export const int32 = [greaterThan(INT_32.min - 1), lessThan(INT_32.max + 1)];
