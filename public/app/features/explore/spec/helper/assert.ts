import { screen } from '@testing-library/react';

export const assertQueryHistoryExists = (query: string) => {
  expect(screen.getByText('1 queries')).toBeInTheDocument();
  const queryItem = screen.getByLabelText('Query text');
  expect(queryItem).toHaveTextContent(query);
};
