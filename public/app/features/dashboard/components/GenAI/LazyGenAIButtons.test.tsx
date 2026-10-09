import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { type Dashboard, type Panel } from '@grafana/schema';

import {
  LazyGenAIDashDescriptionButton,
  LazyGenAIDashTitleButton,
  LazyGenAIPanelDescriptionButton,
  LazyGenAIPanelTitleButton,
} from './LazyGenAIButtons';

interface MockButtonProps {
  onGenerate: (value: string) => void;
}

jest.mock('./GenAIDashDescriptionButton', () => ({
  GenAIDashDescriptionButton: ({ onGenerate }: MockButtonProps) => (
    <button onClick={() => onGenerate('dashboard description')}>Dashboard description</button>
  ),
}));
jest.mock('./GenAIDashTitleButton', () => ({
  GenAIDashTitleButton: ({ onGenerate }: MockButtonProps) => (
    <button onClick={() => onGenerate('dashboard title')}>Dashboard title</button>
  ),
}));
jest.mock('./GenAIPanelDescriptionButton', () => ({
  GenAIPanelDescriptionButton: ({ onGenerate }: MockButtonProps) => (
    <button onClick={() => onGenerate('panel description')}>Panel description</button>
  ),
}));
jest.mock('./GenAIPanelTitleButton', () => ({
  GenAIPanelTitleButton: ({ onGenerate }: MockButtonProps) => (
    <button onClick={() => onGenerate('panel title')}>Panel title</button>
  ),
}));

describe('LazyGenAIButtons', () => {
  it('loads each GenAI control and preserves its generation callback', async () => {
    const user = userEvent.setup();
    const onGenerate = jest.fn();

    render(
      <>
        <LazyGenAIDashDescriptionButton onGenerate={onGenerate} />
        <LazyGenAIDashTitleButton onGenerate={onGenerate} />
        <LazyGenAIPanelDescriptionButton onGenerate={onGenerate} panel={{} as Panel} />
        <LazyGenAIPanelTitleButton onGenerate={onGenerate} panel={{} as Panel} dashboard={{} as Dashboard} />
      </>
    );

    await user.click(await screen.findByRole('button', { name: 'Dashboard description' }));
    await user.click(await screen.findByRole('button', { name: 'Dashboard title' }));
    await user.click(await screen.findByRole('button', { name: 'Panel description' }));
    await user.click(await screen.findByRole('button', { name: 'Panel title' }));

    expect(onGenerate.mock.calls).toEqual([
      ['dashboard description'],
      ['dashboard title'],
      ['panel description'],
      ['panel title'],
    ]);
  });
});
