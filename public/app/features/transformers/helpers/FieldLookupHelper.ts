import { getLinkToDocs } from './getLinkToDocs';

export const FieldLookupHelper = () => {
  return `
  Use this transformation on a field value to look up additional fields from an external source.

  - **Field** - Select a text field.
  - **Lookup** - Select from **Countries**, **USA States**, and **Airports**.

  This transformation currently supports spatial data.

  For example, if you have this data:

  ## Data Set Example

  | Location  | Values |
  |-----------|--------|
  | AL        | 0      |
  | AK        | 10     |
  | Arizona   | 5      |
  | Arkansas  | 1      |
  | Somewhere | 5      |

  With this configuration:

  - Field: location
  - Lookup: USA States

  You'll get the following output:

  ## Transformed Data

  | Location  | ID | Name      | Lng        | Lat        | Values |
  |-----------|----|-----------|------------|------------|--------|
  | AL        | AL | Alabama   | -80.891064 | 12.448457  | 0      |
  | AK        | AK | Arkansas  | -100.891064| 24.448457  | 10     |
  | Arizona   |    |           |            |            | 5      |
  | Arkansas  |    |           |            |            | 1      |
  | Somewhere |    |           |            |            | 5      |
  ${getLinkToDocs()}
  `;
};
