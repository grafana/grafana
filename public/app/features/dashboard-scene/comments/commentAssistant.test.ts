import { buildCommentAssistantContext, buildCommentAssistantPrompt } from './commentAssistant';
import { type CommentThread } from './types';

jest.mock('@grafana/assistant', () => ({
  createAssistantContextItem: jest.fn((type: string, data: Record<string, unknown>) => ({ type, data })),
}));

const pin = {
  dashboardUid: 'dash-1',
  dashboardTitle: 'CPU Overview',
  panelKey: 'panel-2',
  panelTitle: 'CPU usage',
  timeRange: { from: '1000', to: '2000' },
};

const thread: CommentThread = {
  id: 42,
  dashboardUid: 'dash-1',
  anchor: { panelKey: 'panel-2', xNorm: 0.5, yNorm: 0.5 },
  context: { panelTitle: 'CPU usage', timeRange: pin.timeRange },
  resolved: false,
  createdBy: { id: 1, name: 'Alice', avatarUrl: '' },
  createdAt: '2024-01-01T00:00:00Z',
  messages: [
    {
      id: 1,
      threadId: 42,
      author: { id: 1, name: 'Alice', avatarUrl: '' },
      body: 'Spike here looks odd',
      createdAt: '2024-01-01T00:01:00Z',
    },
  ],
};

function structuredPayload(context: ReturnType<typeof buildCommentAssistantContext>) {
  const item = context[1] as { data: { data: Record<string, unknown> } };
  return item.data.data;
}

describe('commentAssistant', () => {
  it('builds context with dashboard and panel data', () => {
    const context = buildCommentAssistantContext(pin);
    expect(context).toHaveLength(2);
    expect(context[0]).toMatchObject({
      type: 'dashboard',
      data: { dashboardUid: 'dash-1', dashboardTitle: 'CPU Overview' },
    });
    expect(structuredPayload(context)).toMatchObject({
      panelKey: 'panel-2',
      panelTitle: 'CPU usage',
      timeRange: pin.timeRange,
    });
  });

  it('includes thread messages in structured context', () => {
    const context = buildCommentAssistantContext(pin, thread);
    expect(structuredPayload(context)).toMatchObject({
      threadId: 42,
      messages: [{ author: 'Alice', body: 'Spike here looks odd', createdAt: '2024-01-01T00:01:00Z' }],
    });
  });

  it('builds compose and thread prompts', () => {
    expect(buildCommentAssistantPrompt(pin)).toContain('adding a comment');
    expect(buildCommentAssistantPrompt(pin, thread)).toContain('Alice: Spike here looks odd');
  });
});
