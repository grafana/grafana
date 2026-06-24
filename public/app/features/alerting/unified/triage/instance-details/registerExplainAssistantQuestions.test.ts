import { provideQuestions } from '@grafana/assistant';

import { buildExplainAssistantQuestions } from './explainAssistantPrompts';
import {
  registerExplainAssistantQuestions,
  unregisterExplainAssistantQuestions,
} from './registerExplainAssistantQuestions';

jest.mock('@grafana/assistant', () => {
  const actual = jest.requireActual('@grafana/assistant');
  return {
    ...actual,
    provideQuestions: jest.fn(() => {
      const setQuestions = jest.fn();
      setQuestions.unregister = jest.fn();
      return setQuestions;
    }),
  };
});

const mockProvideQuestions = jest.mocked(provideQuestions);

describe('registerExplainAssistantQuestions', () => {
  beforeEach(() => {
    mockProvideQuestions.mockClear();
    unregisterExplainAssistantQuestions();
  });

  it('registers questions for the Alert Activity page', () => {
    const questions = buildExplainAssistantQuestions([{ node: { id: 'ctx' } }]);

    registerExplainAssistantQuestions(questions);

    expect(mockProvideQuestions).toHaveBeenCalledWith('/alerting/alerts', questions);
  });

  it('unregisters the previous registration when called again', () => {
    const firstUnregister = jest.fn();
    const secondUnregister = jest.fn();

    mockProvideQuestions
      .mockReturnValueOnce(Object.assign(jest.fn(), { unregister: firstUnregister }))
      .mockReturnValueOnce(Object.assign(jest.fn(), { unregister: secondUnregister }));

    registerExplainAssistantQuestions(buildExplainAssistantQuestions([]));
    registerExplainAssistantQuestions(buildExplainAssistantQuestions([]));

    expect(firstUnregister).toHaveBeenCalled();
    expect(secondUnregister).not.toHaveBeenCalled();
  });

  it('cleans up the active registration', () => {
    const unregister = jest.fn();
    mockProvideQuestions.mockReturnValueOnce(Object.assign(jest.fn(), { unregister }));

    registerExplainAssistantQuestions(buildExplainAssistantQuestions([]));
    unregisterExplainAssistantQuestions();

    expect(unregister).toHaveBeenCalled();
    expect(mockProvideQuestions).toHaveBeenCalledTimes(1);
  });
});
