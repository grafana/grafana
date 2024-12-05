import { useCallback, useState } from 'react';

import { DataSourceSettings } from '@grafana/data';
import { llms } from '@grafana/experimental';
import { useLoadDataSources } from 'app/features/datasources/state';

const OPENAI_MODEL_NAME = 'gpt-4o-mini';
interface LLMDataSourceGuess {
  datasource: string;
  probability: number;
  explanation: string;
}

export function useLLMSuggestions() {
  const [isLoading, setIsLoading] = useState(false);
  const { dataSources, isLoading: isLoadingDataSources } = useLoadDataSources();

  const getSuggestions = useCallback(
    async (query: string) => {
      let suggestions: LLMDataSourceGuess[] = [];

      const enabled = await llms.openai.enabled();

      if (!enabled || query === '' || isLoadingDataSources) {
        return suggestions;
      }

      try {
        setIsLoading(true);

        const completion = await llms.openai.chatCompletions({
          model: OPENAI_MODEL_NAME,
          messages: getMessages(query, dataSources),
        });

        suggestions = JSON.parse(completion.choices[0].message.content);
      } catch (error) {
        console.error('Error fetching LLM suggestions:', error);
      } finally {
        setIsLoading(false);
        return suggestions;
      }
    },
    [dataSources, isLoadingDataSources]
  );

  return { getSuggestions, isLoading: isLoading || isLoadingDataSources };
}

function getMessages(query: string, dataSources: DataSourceSettings[]): llms.openai.Message[] {
  const systemPrompt = `
    The following is a list of data sources available to the user.
    Each of these data sources allows users in Grafana to query data from that location by hitting its APIs,
    often using its own query language:

    ${dataSources.map(({ name }) => name).join('\n')}

    I need you to interpret data that the user pastes in,
    and give your top 3 guesses as to which data source the user is trying to query.
    The valid user inputs are limited to:
    - a direct query
    - a URL that pertains to that data source

    The guesses should be presented as an array of object, each object containing the following fields:
    - datasource: the name of the data source from the list above
    - probability: a number between 0 and 1 representing the likelihood that the user is querying that data source
    - explanation: a string no longer than 100 characters explaining why you think the user is querying that data source

    Do not include data sources with a probability less than 0.2.
    The output should only contain the JSON with no extra formatting so that it can be easily parsed using JSON.parse().
`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ];
}
