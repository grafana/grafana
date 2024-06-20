import {
  DurationFormatConstructor,
  DurationFormatOptions as _DurationFormatOptions,
  DurationInput as _DurationInput,
} from '@formatjs/intl-durationformat/src/types';

declare global {
  namespace Intl {
    const DurationFormat: DurationFormatConstructor;
    type DurationFormatOptions = _DurationFormatOptions;
    type DurationInput = _DurationInput;
  }
}
