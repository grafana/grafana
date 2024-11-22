import { produce } from 'immer';

import { dataQuery, reduceExpression, thresholdExpression } from '../../../mocks';

import { determineAdvancedMode } from './useAdvancedMode';

const dataQueries = [dataQuery];
const expressionQueries = [reduceExpression, thresholdExpression];

describe('determineAdvancedMode', () => {
  it('should return true if simplifiedQueryEditor is false', () => {
    const editorSettings = { simplifiedQueryEditor: false, simplifiedNotificationEditor: true };
    const isGrafanaAlertingType = true;
    const isNewFromQueryParams = false;

    const result = determineAdvancedMode(
      editorSettings,
      isGrafanaAlertingType,
      isNewFromQueryParams,
      dataQueries,
      expressionQueries
    );

    expect(result).toBe(true);
  });

  it('should return true if isGrafanaAlertingType is false', () => {
    const editorSettings = { simplifiedQueryEditor: true, simplifiedNotificationEditor: true };
    const isGrafanaAlertingType = false;
    const isNewFromQueryParams = false;

    const result = determineAdvancedMode(
      editorSettings,
      isGrafanaAlertingType,
      isNewFromQueryParams,
      dataQueries,
      expressionQueries
    );

    expect(result).toBe(true);
  });

  const editorSettings = { simplifiedQueryEditor: true, simplifiedNotificationEditor: true };
  it('should return true if isNewFromQueryParams is true and queries are not transformable', () => {
    const isGrafanaAlertingType = true;
    const isNewFromQueryParams = true;

    const newQuery = produce(dataQuery, (draft) => {
      draft.refId = 'whatever';
    });

    const result = determineAdvancedMode(
      editorSettings,
      isGrafanaAlertingType,
      isNewFromQueryParams,
      [newQuery],
      expressionQueries
    );

    expect(result).toBe(true);
  });

  it('should return false if all conditions are false', () => {
    const isGrafanaAlertingType = true;
    const isNewFromQueryParams = false;

    const result = determineAdvancedMode(
      editorSettings,
      isGrafanaAlertingType,
      isNewFromQueryParams,
      dataQueries,
      expressionQueries
    );

    expect(result).toBe(false);
  });
});
