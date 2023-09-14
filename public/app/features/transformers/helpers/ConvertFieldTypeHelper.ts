import { getLinkToDocs } from './getLinkToDocs';

export const convertFieldTypeHelper = () => {
  return `
  This transformation changes the field type of the specified field.

  - **Field -** Select from available fields
  - **as -** Select the FieldType to convert to
    - **Numeric -** attempts to make the values numbers
    - **String -** will make the values strings
    - **Time -** attempts to parse the values as time
      - Will show an option to specify a DateFormat as input by a string like yyyy-mm-dd or DD MM YYYY hh:mm:ss
    - **Boolean -** will make the values booleans

  For example, the following query could be modified by selecting the time field, as Time, and Date Format as YYYY.

  ## Sample Query

  | Time       | Mark      | Value |
  |------------|-----------|-------|
  | 2017-07-01 | above     | 25    |
  | 2018-08-02 | below     | 22    |
  | 2019-09-02 | below     | 29    |
  | 2020-10-04 | above     | 22    |

  The result:

  ## Transformed Query

  | Time                | Mark      | Value |
  |---------------------|-----------|-------|
  | 2017-01-01 00:00:00 | above     | 25    |
  | 2018-01-01 00:00:00 | below     | 22    |
  | 2019-01-01 00:00:00 | below     | 29    |
  | 2020-01-01 00:00:00 | above     | 22    |
  ${getLinkToDocs()}
  `;
};
