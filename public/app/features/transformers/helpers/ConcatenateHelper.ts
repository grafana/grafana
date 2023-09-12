import { getLinkToDocs } from './getLinkToDocs';

export const ConcatenateHelper = () => {
  return `
  This transformation combines all fields from all frames into one result. Consider the following:

  **Query A:**

  | Temp  | Uptime    |
  | ----- | --------- |
  | 15.4  | 1230233   |

  Query B:

  | AQI   | Errors |
  | ----- | ------ |
  | 3.2   | 5      |

  After you concatenate the fields, the data frame would be:

  | Temp  | Uptime   | AQI   | Errors |
  | ----- | -------- | ----- | ------ |
  | 15.4  | 1230233  | 3.2   | 5      |
  ${getLinkToDocs()}
  `;
};
