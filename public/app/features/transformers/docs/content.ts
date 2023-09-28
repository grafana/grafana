export const transformationDocsContent = {
  calculateField: {
    name: '',
    content: `
    Use this transformation to add a new field calculated from two other fields. Each transformation allows you to add one new field.
  
    - **Mode -** Select a mode:
      - **Reduce row -** Apply selected calculation on each row of selected fields independently.
      - **Binary option -** Apply basic math operation(sum, multiply, etc) on values in a single row from two selected fields.
      - **Index -** Will insert a field with the row index.
    - **Field name -** Select the names of fields you want to use in the calculation for the new field.
    - **Calculation -** If you select **Reduce row** mode, then the **Calculation** field appears. Click in the field to see a list of calculation choices you can use to create the new field. For information about available calculations, refer to [Calculation types]({{< relref "../../calculation-types" >}}).
    - **Operation -** If you select **Binary option** mode, then the **Operation** fields appear. These fields allow you to do basic math operations on values in a single row from two selected fields. You can also use numerical values for binary operations.
    - **Alias -** (Optional) Enter the name of your new field. If you leave this blank, then the field will be named to match the calculation.
    - **Replace all fields -** (Optional) Select this option if you want to hide all other fields and display only your calculated field in the visualization.
    `,
  },
  concatenate: {
    name: '',
    content: `
    Use this transformation to combine all fields from all frames into one result. Consider the following:

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
    `,
  },
  // configFromData: configFromQueryHelper,
  // convertFieldType: convertFieldTypeHelper,
  // extractFields: extractFieldsHelper,
  // fieldLookup: fieldLookupHelper,
  // filterByRefId: filterByRefIdHelper,
  // filterByValue: filterByValueHelper,
  // filterFieldsByName: filterFieldsByNameHelper,
  // formatTime: formatTimeHelper,
  // groupBy: groupByHelper,
  // groupingToMatrix: groupingToMatrixHelper,
  // heatmap: createHeatmapHelper,
  // histogram: histogramHelper,
  // joinByField: joinByFieldHelper,
  // joinByLabels: joinByLabelsHelper,
  // labelsToFields: labelsToFieldsHelper,
  // limit: limitHelper,
  // merge: mergeHelper,
  // organize: organizeFieldsHelper,
  // partitionByValues: partitionByValuesHelper,
  // prepareTimeSeries: prepareTimeSeriesHelper,
  // reduce: reduceHelper,
  // renameByRegex: renameByRegexHelper,
  // rowsToFields: rowsToFieldsHelper,
  // seriesToRows: seriesToRowsHelper,
  // sortBy: sortByHelper,
  // spatial: spatialHelper,
  // timeSeriesTable: timeSeriesTableHelper,
};
