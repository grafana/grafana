// This helper class is used to make typescript warn you when you miss a case-block in a switch statement.
// For example:
//
// const x:'A'|'B'|'C' = 'A';
//
// switch(x) {
//   case 'A':
//     // something
//   case 'B':
//     // something
//   default:
//     throw new NeverCaseError(x);
// }
//
//
// TypeScript detect the missing case and display an error.

export class NeverCaseError extends Error {
  constructor(value: never) {
    super(`Unexpected case in switch statement: ${JSON.stringify(value)}`);
  }
}
