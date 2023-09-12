import { getLinkToDocs } from './getLinkToDocs';

export const JoinByLabelsHelper = () => {
  return `
  Use this transformation to join multiple results into a single table. This is especially useful for converting multiple
  time series results into a single wide table with a shared **Label** field.

  - **Join** - Select the label to join by between the labels available or common across all time series.
  - **Value** - The name for the output result.

  #### Example

  ##### Input

  serie1{what="Temp", cluster="A", job="J1"}

  | Time | Value |
  | ---- | ----- |
  | 1    | 10    |
  | 2    | 200   |

  serie2{what="Temp", cluster="B", job="J1"}

  | Time | Value |
  | ---- | ----- |
  | 1    | 10    |
  | 2    | 200   |

  serie3{what="Speed", cluster="B", job="J1"}

  | Time | Value |
  | ---- | ----- |
  | 22   | 22    |
  | 28   | 77    |

  ##### Config

  value: "what"

  ##### Output

  | cluster | job | Temp | Speed |
  | ------- | --- | ---- | ----- |
  | A       | J1  | 10   |       |
  | A       | J1  | 200  |       |
  | B       | J1  | 10   | 22    |
  | B       | J1  | 200  | 77    |
  ${getLinkToDocs()}
  `;
};
