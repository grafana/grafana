import { llms } from '@grafana/experimental';

import { GeneratePayload } from '../utils';

export const SPECIAL_DONE_TOKEN = '~';

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

  const getContent = () => {
    if (subject === 'title') {
      return (
        'You are an expert in creating Grafana Panels.' +
        'Your goal is to write short, descriptive, and concise panel titles for a given panel described by a JSON object' +
        'The title should be shorter than 50 characters. ' +
        `When you are done with the title, write "${SPECIAL_DONE_TOKEN}".`
      );
    }

    return (
      'You are an expert in creating Grafana Panels.' +
      'Your goal is to write short, descriptive, and concise panel descriptions for a given panel described by a JSON object.' +
      'The description should be shorter than 150 characters' +
      'Describe what this panel might be monitoring and why it is useful.' +
      `When you are done with the description, write "${SPECIAL_DONE_TOKEN}".`
    );
  };

  llms.openai
    .streamChatCompletions({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: getContent(),
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
