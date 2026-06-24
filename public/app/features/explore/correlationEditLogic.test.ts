import { CORRELATION_EDITOR_POST_CONFIRM_ACTION } from 'app/types/explore';

import { showModalMessage } from './correlationEditLogic';

// note, closing the editor does not care if isLeft is true or not. Both are covered for regression purposes.
describe('correlationEditLogic', function () {
  it.each`
    action                                                      | isLeft   | dirCor   | dirQuer  | expected
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE}        | ${false} | ${false} | ${false} | ${undefined}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE}        | ${false} | ${true}  | ${false} | ${'Closing the pane will cause the correlation in progress to be lost. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE}        | ${false} | ${false} | ${true}  | ${'Closing the pane will lose the changed query. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE}        | ${false} | ${true}  | ${true}  | ${'Closing the pane will cause the correlation in progress to be lost. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE}        | ${true}  | ${false} | ${false} | ${undefined}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE}        | ${true}  | ${true}  | ${false} | ${'Closing the pane will cause the correlation in progress to be lost. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE}        | ${true}  | ${false} | ${true}  | ${'Closing the pane will cause the query in the right pane to be re-ran and links added to that data. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_PANE}        | ${true}  | ${true}  | ${true}  | ${'Closing the pane will cause the correlation in progress to be lost. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE} | ${false} | ${false} | ${false} | ${undefined}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE} | ${false} | ${true}  | ${false} | ${undefined}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE} | ${false} | ${false} | ${true}  | ${'Changing the datasource will lose the changed query. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE} | ${false} | ${true}  | ${true}  | ${'Changing the datasource will lose the changed query. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE} | ${true}  | ${false} | ${false} | ${undefined}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE} | ${true}  | ${true}  | ${false} | ${'Changing the datasource will cause the correlation in progress to be lost. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE} | ${true}  | ${false} | ${true}  | ${undefined}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CHANGE_DATASOURCE} | ${true}  | ${true}  | ${true}  | ${'Changing the datasource will cause the correlation in progress to be lost. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_EDITOR}      | ${false} | ${false} | ${false} | ${undefined}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_EDITOR}      | ${false} | ${true}  | ${false} | ${'Closing the editor will cause the correlation in progress to be lost. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_EDITOR}      | ${false} | ${false} | ${true}  | ${'Closing the editor will remove the variables, and your changed query may no longer be valid. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_EDITOR}      | ${false} | ${true}  | ${true}  | ${'Closing the editor will cause the correlation in progress to be lost. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_EDITOR}      | ${true}  | ${false} | ${false} | ${undefined}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_EDITOR}      | ${true}  | ${true}  | ${false} | ${'Closing the editor will cause the correlation in progress to be lost. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_EDITOR}      | ${true}  | ${false} | ${true}  | ${'Closing the editor will remove the variables, and your changed query may no longer be valid. Would you like to save before continuing?'}
    ${CORRELATION_EDITOR_POST_CONFIRM_ACTION.CLOSE_EDITOR}      | ${true}  | ${true}  | ${true}  | ${'Closing the editor will cause the correlation in progress to be lost. Would you like to save before continuing?'}
  `(
    "Action $action, isLeft=$isLeft, dirtyCorrelation=$dirCor, dirtyQueryEditor=$dirQuer should return message '$expected'",
    ({ action, isLeft, dirCor, dirQuer, expected }) => {
      expect(showModalMessage(action, isLeft, dirCor, dirQuer)).toEqual(expected);
    }
  );
});
