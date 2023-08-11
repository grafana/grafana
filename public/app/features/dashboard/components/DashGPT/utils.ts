import { llms } from '@grafana/experimental';

import { GeneratePayload } from '../PanelEditor/utils';

export const SPECIAL_DONE_TOKEN = '~';

const TITLE_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Panels.' +
  'Your goal is to write short, descriptive, and concise panel titles for a given panel described by a JSON object' +
  'The title should be shorter than 50 characters. ' +
  `When you are done with the title, write "${SPECIAL_DONE_TOKEN}".`;

const DESCRIPTION_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Panels.' +
  'Your goal is to write short, descriptive, and concise panel descriptions for a given panel described by a JSON object.' +
  'The description should be shorter than 150 characters' +
  'Describe what this panel might be monitoring and why it is useful.' +
  `When you are done with the description, write "${SPECIAL_DONE_TOKEN}".`;

const QUICK_FEEDBACK_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Panels.' +
  'Your goal is to generate 2 short improvement possibilities for a given panel described by a JSON object.' +
  'The quick feedback should be shorter than 20 characters.' +
  'The feedback should refer to configurable properties from Grafana panel JSON' +
  'Return both responses separated by comma.' +
  `When you are done with the description, write "${SPECIAL_DONE_TOKEN}".`;

const getContent = (subject: string) => {
  switch (subject) {
    case 'title':
      return TITLE_GENERATION_STANDARD_PROMPT;
    case 'description':
      return DESCRIPTION_GENERATION_STANDARD_PROMPT;
    case 'quickFeedback':
      return QUICK_FEEDBACK_GENERATION_STANDARD_PROMPT;
    default:
      return '';
  }
};

export const onGenerateTextWithAi = async (
  payload: GeneratePayload,
  subject: string,
  setLlmReply: (response: string, subject: string) => void
) => {
  // Check if the LLM plugin is enabled and configured.
  // If not, we won't be able to make requests, so return early.
  const enabled = await llms.openai.enabled();
  if (!enabled) {
    return { enabled };
  }

  llms.openai
    .streamChatCompletions({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: getContent(subject),
        },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    })
    .pipe(
      // Accumulate the stream content into a stream of strings, where each
      // element contains the accumulated message so far.
      llms.openai.accumulateContent()
    )
    .subscribe((response) => setLlmReply(response, subject));

  return { enabled };
};

export const regenerateResponseWithFeedback = async (
  payload: GeneratePayload,
  subject: string,
  originalResponse: string,
  feedback: string
) => {
  // Check if the LLM plugin is enabled and configured.
  // If not, we won't be able to make requests, so return early.
  const enabled = await llms.openai.enabled();
  if (!enabled) {
    return { enabled };
  }

  return await llms.openai
    .chatCompletions({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: getContent(subject),
        },
        {
          role: 'system',
          content: JSON.stringify(payload),
        },
        {
          role: 'system',
          content: `Your previous response was: ${originalResponse}. The user has provided the following feedback: ${feedback}. Re-generate your response according to the provided feedback.`,
        },
      ],
    })
    .then((response) => response.choices[0].message.content);
};

export const generateQuickFeedback = async (payload: any, userInput: string) => {
  // Check if the LLM plugin is enabled and configured.
  // If not, we won't be able to make requests, so return early.
  const enabled = await llms.openai.enabled();
  if (!enabled) {
    return { enabled };
  }

  return await llms.openai
    .chatCompletions({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: getContent('quickFeedback'),
        },
        {
          role: 'user',
          content: userInput,
        },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    })
    .then((response) => response.choices[0].message.content);
};

export const getGeneratedQuickFeedback = async (panel: any, promptValue: string) => {
  let quickFeedback = await generateQuickFeedback(panel, promptValue);
  let quickFeedbackChoices: string[] = [];
  if (typeof quickFeedback === 'string') {
    quickFeedback = quickFeedback.replace(SPECIAL_DONE_TOKEN, '');
    quickFeedback = quickFeedback.replace(/"/g, '');

    quickFeedbackChoices = quickFeedback.split(',');
  }

  // :(
  if (quickFeedbackChoices.length > 2) {
    quickFeedbackChoices = quickFeedbackChoices.slice(0, 2);
  }

  return quickFeedbackChoices;
};

export interface GeneratedPanel {
  panels: any[];
  quickFeedback: string[];
}
