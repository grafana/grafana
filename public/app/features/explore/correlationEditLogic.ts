import { template } from 'lodash';

import { CORRELATION_EDITOR_POST_CONFIRM_ACTION } from 'app/types/explore';

enum CONSEQUENCES {
  SOURCE_TARGET_CHANGE = 'cause the query in the right pane to be re-ran and links added to that data',
  FULL_QUERY_LOSS = 'lose the changed query',
  FULL_CORR_LOSS = 'cause the correlation in progress to be lost',
  INVALID_VAR = 'remove the variables, and your changed query may no longer be valid',
}

// returns a string if the modal should show, with what the message string should be
// returns undefined if the modal shouldn't show
export const showModalMessage = (
  action: CORRELATION_EDITOR_POST_CONFIRM_ACTION,
  isActionLeft: boolean,
  dirtyCorrelation: boolean,
  dirtyQueryEditor: boolean
) => {
  const messageTemplate = template(
    '<%= actionStr %> will <%= consequenceStr %>. Would you like to save before continuing?'
  );
  let actionStr = '';
  let consequenceStr = '';

  // dirty correlation message always takes priority over dirty query
  if (action === CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE) {
    actionStr = 'Closing the pane';
    if (isActionLeft) {
      if (dirtyCorrelation) {
        consequenceStr = CONSEQUENCES.FULL_CORR_LOSS;
      } else if (dirtyQueryEditor) {
        consequenceStr = CONSEQUENCES.SOURCE_TARGET_CHANGE;
      } else {
        return undefined;
      }
    } else {
      // right pane close
      if (dirtyCorrelation) {
        consequenceStr = CONSEQUENCES.FULL_CORR_LOSS;
      } else if (dirtyQueryEditor) {
        consequenceStr = CONSEQUENCES.FULL_QUERY_LOSS;
      } else {
        return undefined;
      }
    }
  } else if (action === CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE) {
    actionStr = 'Changing the datasource';
    if (isActionLeft) {
      if (dirtyCorrelation) {
        consequenceStr = CONSEQUENCES.FULL_CORR_LOSS;
      } else {
        return undefined;
      }
    } else {
      // right datasource change
      if (dirtyQueryEditor) {
        consequenceStr = CONSEQUENCES.FULL_QUERY_LOSS;
      } else {
        return undefined;
      }
    }
  } else if (action === CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_EDITOR) {
    actionStr = 'Closing the editor';
    if (dirtyCorrelation) {
      consequenceStr = CONSEQUENCES.FULL_CORR_LOSS;
    } else if (dirtyQueryEditor) {
      consequenceStr = CONSEQUENCES.INVALID_VAR;
    } else {
      return undefined;
    }
  }
  return messageTemplate({ actionStr, consequenceStr });
};
