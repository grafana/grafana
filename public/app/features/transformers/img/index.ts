import config from 'app/core/config';

const getImagePath = (image: { light: string; dark: string }) => {
  return config.theme2.isDark ? image.dark : image.light;
};

export const addToField = getImagePath({
  dark: require('../../../img/transformations/dark/addToField.svg'),
  light: require('../../../img/transformations/light/addToField.svg'),
});

export const concatenate = getImagePath({
  dark: require('../../../img/transformations/dark/concatenate.svg'),
  light: require('../../../img/transformations/light/concatenate.svg'),
});

export const configFromQueryResults = getImagePath({
  dark: require('../../../img/transformations/dark/configFromQueryResults.svg'),
  light: require('../../../img/transformations/light/configFromQueryResults.svg'),
});

export const convertFieldType = getImagePath({
  dark: require('../../../img/transformations/dark/convertFieldType.svg'),
  light: require('../../../img/transformations/light/convertFieldType.svg'),
});

export const createHeatmap = getImagePath({
  dark: require('../../../img/transformations/dark/createHeatmap.svg'),
  light: require('../../../img/transformations/light/createHeatmap.svg'),
});

export const extractFields = getImagePath({
  dark: require('../../../img/transformations/dark/extractFields.svg'),
  light: require('../../../img/transformations/light/extractFields.svg'),
});

export const fieldLookup = getImagePath({
  dark: require('../../../img/transformations/dark/fieldLookup.svg'),
  light: require('../../../img/transformations/light/fieldLookup.svg'),
});

export const filterByName = getImagePath({
  dark: require('../../../img/transformations/dark/filterByName.svg'),
  light: require('../../../img/transformations/light/filterByName.svg'),
});

export const filterByQuery = getImagePath({
  dark: require('../../../img/transformations/dark/filterByQuery.svg'),
  light: require('../../../img/transformations/light/filterByQuery.svg'),
});

export const filterByValues = getImagePath({
  dark: require('../../../img/transformations/dark/filterByValues.svg'),
  light: require('../../../img/transformations/light/filterByValues.svg'),
});

export const groupBy = getImagePath({
  dark: require('../../../img/transformations/dark/groupBy.svg'),
  light: require('../../../img/transformations/light/groupBy.svg'),
});

export const groupByCalculation = getImagePath({
  dark: require('../../../img/transformations/dark/groupByCalculation.svg'),
  light: require('../../../img/transformations/light/groupByCalculation.svg'),
});

export const groupingByMatrix = getImagePath({
  dark: require('../../../img/transformations/dark/groupingByMatrix.svg'),
  light: require('../../../img/transformations/light/groupingByMatrix.svg'),
});

export const histogram = getImagePath({
  dark: require('../../../img/transformations/dark/histogram.svg'),
  light: require('../../../img/transformations/light/histogram.svg'),
});

export const joinByField = getImagePath({
  dark: require('../../../img/transformations/dark/joinByField.svg'),
  light: require('../../../img/transformations/light/joinByField.svg'),
});

export const joinByLabel = getImagePath({
  dark: require('../../../img/transformations/dark/joinByLabel.svg'),
  light: require('../../../img/transformations/light/joinByLabel.svg'),
});

export const labelsToFields = getImagePath({
  dark: require('../../../img/transformations/dark/labelsToFields.svg'),
  light: require('../../../img/transformations/light/labelsToFields.svg'),
});

export const limit = getImagePath({
  dark: require('../../../img/transformations/dark/limit.svg'),
  light: require('../../../img/transformations/light/limit.svg'),
});

export const merge = getImagePath({
  dark: require('../../../img/transformations/dark/merge.svg'),
  light: require('../../../img/transformations/light/merge.svg'),
});

export const organize = getImagePath({
  dark: require('../../../img/transformations/dark/organize.svg'),
  light: require('../../../img/transformations/light/organize.svg'),
});

export const partitionByValues = getImagePath({
  dark: require('../../../img/transformations/dark/partitionByValues.svg'),
  light: require('../../../img/transformations/light/partitionByValues.svg'),
});

export const prepareTimeSeries = getImagePath({
  dark: require('../../../img/transformations/dark/prepareTimeSeries.svg'),
  light: require('../../../img/transformations/light/prepareTimeSeries.svg'),
});

export const reduce = getImagePath({
  dark: require('../../../img/transformations/dark/reduce.svg'),
  light: require('../../../img/transformations/light/reduce.svg'),
});

export const renameByRegex = getImagePath({
  dark: require('../../../img/transformations/dark/renameByRegex.svg'),
  light: require('../../../img/transformations/light/renameByRegex.svg'),
});

export const rowsToFields = getImagePath({
  dark: require('../../../img/transformations/dark/rowsToFields.svg'),
  light: require('../../../img/transformations/light/rowsToFields.svg'),
});

export const seriesToRows = getImagePath({
  dark: require('../../../img/transformations/dark/seriesToRows.svg'),
  light: require('../../../img/transformations/light/seriesToRows.svg'),
});

export const sort = getImagePath({
  dark: require('../../../img/transformations/dark/sort.svg'),
  light: require('../../../img/transformations/light/sort.svg'),
});

export const spatialOperations = getImagePath({
  dark: require('../../../img/transformations/dark/spatialOperations.svg'),
  light: require('../../../img/transformations/light/spatialOperations.svg'),
});
