import { llms } from '@grafana/experimental';

import { GeneratePayload } from '../utils';

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

const getContent = (subject: string) => {
  if (subject === 'title') {
    return TITLE_GENERATION_STANDARD_PROMPT;
  }

  return DESCRIPTION_GENERATION_STANDARD_PROMPT;
};

export const fetchData = async (
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
