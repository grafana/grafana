// this class is used in a switch statement below,
// and this guarantees that all the possible type-values
// are handled. if we forget a `case` there, the typescript
// compiler will raise an error.
export class NeverCaseError extends Error {
  constructor(value: never) {
    super('should never happen');
  }
}
