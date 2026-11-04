import { locationService } from '@grafana/runtime';

import { createNotebookWithContent } from '../addPanel/addPanelToNotebook';

import { promoteScratchpad } from './promoteScratchpad';
import { addNote, clearScratchpad, getScratchpad, setTitle } from './scratchpadStore';

jest.mock('../addPanel/addPanelToNotebook', () => ({ createNotebookWithContent: jest.fn() }));
jest.mock('app/store/store', () => ({ dispatch: jest.fn() }));

const createMock = jest.mocked(createNotebookWithContent);

describe('promoteScratchpad', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearScratchpad();
    createMock.mockReset();
  });

  it('creates the notebook in block order, clears the draft and opens it', async () => {
    const push = jest.spyOn(locationService, 'push').mockImplementation(() => {});
    createMock.mockResolvedValue({ uid: 'nb-1', title: 'Latency' });
    setTitle('Latency');
    addNote('# Heading');
    addNote('body');

    await promoteScratchpad();

    expect(createMock).toHaveBeenCalledWith(
      { title: 'Latency' },
      [
        { kind: 'markdown', text: '# Heading' },
        { kind: 'markdown', text: 'body' },
      ],
      'quick_add'
    );
    expect(getScratchpad().blocks).toEqual([]);
    expect(push).toHaveBeenCalledWith(expect.stringContaining('nb-1'));
  });

  it('keeps the draft when the create fails', async () => {
    createMock.mockRejectedValue(new Error('boom'));
    addNote('keep me');

    await expect(promoteScratchpad()).rejects.toThrow('boom');

    expect(getScratchpad().blocks).toHaveLength(1);
  });
});
