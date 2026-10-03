import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { toDataFrame } from '@grafana/data';
import { mockBoundingClientRect } from '@grafana/test-utils';

import { ExplainScorePopup } from './ExplainScorePopup';

it.each([
  { tab: 'Score', otherTab: 'Allowed actions', original: '{ "score": 42}' },
  { tab: 'Allowed actions', otherTab: 'Score', original: '{ "dsUids": [], "allowedActions": []}' },
])('keeps $tab edits temporary and resets them after switching tabs', async ({ tab, otherTab, original }) => {
  mockBoundingClientRect();
  const user = userEvent.setup();
  const props = { name: 'Search explanation', explain: { score: 42 }, frame: toDataFrame([]), row: 0 };
  const { rerender } = render(<ExplainScorePopup {...props} />);

  await user.click(screen.getByRole('tab', { name: tab }));
  const editor = await screen.findByRole('textbox', { name: tab });
  expect(editor).toHaveTextContent(original);

  await user.click(editor);
  await user.keyboard('{Control>}a{/Control}');
  await user.paste('temporary edit');
  rerender(<ExplainScorePopup {...props} />);
  expect(editor).toHaveTextContent('temporary edit');

  await user.click(screen.getByRole('tab', { name: otherTab }));
  await screen.findByRole('textbox', { name: otherTab });
  await user.click(screen.getByRole('tab', { name: tab }));
  expect(await screen.findByRole('textbox', { name: tab })).toHaveTextContent(original);
});
