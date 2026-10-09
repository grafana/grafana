/* eslint-disable jest-dom/prefer-to-have-text-content -- Assert exact text, including JSON whitespace, rather than a substring. */
import { render, screen } from '@testing-library/react';
import Prism from 'prismjs';

import { createTheme } from '@grafana/data';

import JsonSyntaxHighlight from './JsonSyntaxHighlight';

it('bounds token spans without dropping any text', () => {
  const text = JSON.stringify(Array.from({ length: 2499 }, () => 0));
  const { container, rerender } = render(<JsonSyntaxHighlight text={text} theme={createTheme()} />);
  expect(container.textContent).toBe(text);
  expect(container.querySelectorAll('span[style]')).toHaveLength(4999);
  const dense = JSON.stringify(Array.from({ length: 2500 }, () => 0));
  rerender(<JsonSyntaxHighlight text={dense} theme={createTheme()} />);
  expect(container.textContent).toBe(dense);
  expect(container.querySelector('span')).not.toBeInTheDocument();
});

it('preserves complete text if tokenization fails', () => {
  const tokenize = jest.spyOn(Prism, 'tokenize').mockImplementationOnce(() => {
    throw new Error('tokenization failed');
  });
  const { container } = render(<JsonSyntaxHighlight text={'{"key":true}'} theme={createTheme()} />);
  expect(container.textContent).toBe('{"key":true}');
  expect(container.querySelector('span')).not.toBeInTheDocument();
  tokenize.mockRestore();
});

it('updates theme colors without changing text', () => {
  const darkTheme = createTheme();
  const lightTheme = createTheme({ colors: { mode: 'light' } });
  const { container, rerender } = render(<JsonSyntaxHighlight text={'{"key":true}'} theme={darkTheme} />);
  expect(screen.getByText('true')).toHaveStyle({ color: darkTheme.components.codeEditor.number });
  rerender(<JsonSyntaxHighlight text={'{"key":true}'} theme={lightTheme} />);
  expect(screen.getByText('true')).toHaveStyle({ color: lightTheme.components.codeEditor.number });
  expect(container.textContent).toBe('{"key":true}');
});
