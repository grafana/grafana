import { waitFor } from '@testing-library/react';

import { withinQueryHistory, withinQueryLibrary } from './setup';

export const assertQueryHistoryExists = async (query: string) => {
  const selector = withinQueryHistory();

  expect(await selector.findByText('1 queries')).toBeInTheDocument();
  const queryItem = selector.getByLabelText('Query text');
  expect(queryItem).toHaveTextContent(query);
};

export const assertQueryHistory = async (expectedQueryTexts: string[]) => {
  const selector = withinQueryHistory();

  await waitFor(() => {
    expect(selector.getByText(new RegExp(`${expectedQueryTexts.length} queries`))).toBeInTheDocument();
    const queryTexts = selector.getAllByLabelText('Query text');
    expectedQueryTexts.forEach((expectedQueryText, queryIndex) => {
      expect(queryTexts[queryIndex]).toHaveTextContent(expectedQueryText);
    });
  });
};

export const assertQueryLibraryTemplateExists = async (datasource: string, description: string) => {
  const selector = withinQueryLibrary();
  await waitFor(() => {
    const cell = selector.getByRole('radio', {
      name: description,
    });

    expect(cell).toBeInTheDocument();
  });
};

export const assertAddToQueryLibraryButtonExists = async (value = true) => {
  await waitFor(() => {
    // ensures buttons for the card have been loaded to avoid false positives
    expect(withinQueryHistory().getByRole('button', { name: /run query/i })).toBeInTheDocument();

    if (value) {
      expect(withinQueryHistory().queryByRole('button', { name: /add to library/i })).toBeInTheDocument();
    } else {
      expect(withinQueryHistory().queryByRole('button', { name: /add to library/i })).not.toBeInTheDocument();
    }
  });
};

export const assertQueryHistoryIsEmpty = async () => {
  const selector = withinQueryHistory();
  const queryTexts = selector.queryAllByLabelText('Query text');

  expect(await queryTexts).toHaveLength(0);
};

export const assertQueryHistoryComment = async (expectedQueryComments: string[]) => {
  const selector = withinQueryHistory();
  await waitFor(() => {
    expect(selector.getByText(new RegExp(`${expectedQueryComments.length} queries`))).toBeInTheDocument();
    const queryComments = selector.getAllByLabelText('Query comment');
    expectedQueryComments.forEach((expectedQueryText, queryIndex) => {
      expect(queryComments[queryIndex]).toHaveTextContent(expectedQueryText);
    });
  });
};

export const assertQueryHistoryTabIsSelected = (tabName: 'Query history' | 'Starred' | 'Settings') => {
  expect(withinQueryHistory().getByRole('tab', { name: tabName, selected: true })).toBeInTheDocument();
};

export const assertDataSourceFilterVisibility = (visible: boolean) => {
  const filterInput = withinQueryHistory().queryByLabelText('Filter queries for data sources(s)');
  if (visible) {
    expect(filterInput).toBeInTheDocument();
  } else {
    expect(filterInput).not.toBeInTheDocument();
  }
};

export const assertQueryHistoryElementsShown = (shown: number, total: number) => {
  expect(withinQueryHistory().queryByText(`Showing ${shown} of ${total}`)).toBeInTheDocument();
};

export const assertLoadMoreQueryHistoryNotVisible = () => {
  expect(withinQueryHistory().queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
};
