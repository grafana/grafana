export const histogramHelper = () => {
  return `
  Use this transformation to generate a histogram based on the input data.

  - **Bucket size** - The distance between the lowest item in the bucket (xMin) and the highest item in the bucket (xMax).
  - **Bucket offset** - The offset for non-zero based buckets.
  - **Combine series** - Create a histogram using all the available series.

  **Original data**

  Series 1:

  | A   | B   | C   |
  | --- | --- | --- |
  | 1   | 3   | 5   |
  | 2   | 4   | 6   |
  | 3   | 5   | 7   |
  | 4   | 6   | 8   |
  | 5   | 7   | 9   |

  Series 2:

  | C   |
  | --- |
  | 5   |
  | 6   |
  | 7   |
  | 8   |
  | 9   |

  **Output**

  | xMin | xMax | A   | B   | C   | C   |
  | ---- | ---- | --- | --- | --- | --- |
  | 1    | 2    | 1   | 0   | 0   | 0   |
  | 2    | 3    | 1   | 0   | 0   | 0   |
  | 3    | 4    | 1   | 1   | 0   | 0   |
  | 4    | 5    | 1   | 1   | 0   | 0   |
  | 5    | 6    | 1   | 1   | 1   | 1   |
  | 6    | 7    | 0   | 1   | 1   | 1   |
  | 7    | 8    | 0   | 1   | 1   | 1   |
  | 8    | 9    | 0   | 0   | 1   | 1   |
  | 9    | 10   | 0   | 0   | 1   | 1   |
  `;
};
