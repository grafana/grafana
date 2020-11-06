import { ObservableMatchers } from './types';
import { toEmitValues } from './toEmitValues';
import { toCompleteWith } from './toCompleteWith';
import { Observable } from 'rxjs';

export const matchers: ObservableMatchers<void, Observable<any>> = {
  toEmitValues,
  toCompleteWith,
};
