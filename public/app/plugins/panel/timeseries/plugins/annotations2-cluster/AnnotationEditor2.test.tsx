import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { usePanelContext } from '@grafana/ui';

import { AnnotationEditor2 } from './AnnotationEditor2';
import { type AnnotationVals } from './types';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  usePanelContext: jest.fn(),
}));

const mockUsePanelContext = jest.mocked(usePanelContext);

describe('onSubmit', () => {
  const annoVals: AnnotationVals = {
    time: [1759388895560],
    timeEnd: [1759389095560],
    text: ['My description'],
    tags: [['tag1', 'tag2']],
    id: [null],
    isRegion: [true],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is called on annotation create', async () => {
    const onAnnotationCreate = jest.fn().mockResolvedValue(undefined);
    mockUsePanelContext.mockReturnValue({
      onAnnotationCreate,
      onAnnotationUpdate: jest.fn(),
      eventsScope: '',
      // @ts-ignore
      eventBus: jest.fn(),
    });

    render(<AnnotationEditor2 annoVals={annoVals} annoIdx={0} timeZone="browser" dismiss={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAnnotationCreate).toHaveBeenCalledWith({
      id: undefined,
      tags: ['tag1', 'tag2'],
      description: 'My description',
      from: 1759388895560,
      to: 1759389095560,
    });
  });

  it('is called on annotation update', async () => {
    const onAnnotationUpdate = jest.fn().mockResolvedValue(undefined);
    mockUsePanelContext.mockReturnValue({
      onAnnotationCreate: jest.fn(),
      onAnnotationUpdate,
      eventsScope: '',
      // @ts-ignore
      eventBus: jest.fn(),
    });

    render(
      <AnnotationEditor2
        annoVals={{ ...annoVals, ...{ id: [4683] } }}
        annoIdx={0}
        timeZone="browser"
        dismiss={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAnnotationUpdate).toHaveBeenCalledWith({
      id: '4683',
      tags: ['tag1', 'tag2'],
      description: 'My description',
      from: 1759388895560,
      to: 1759389095560,
    });
  });
});
