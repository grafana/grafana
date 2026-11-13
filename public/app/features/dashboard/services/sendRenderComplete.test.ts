import { sendRenderComplete } from './sendRenderComplete';

describe('sendRenderComplete', () => {
  let messageChannelMock: jest.Mock;

  beforeEach(() => {
    messageChannelMock = jest.fn();
    window.__grafanaImageRendererMessageChannel = messageChannelMock;
  });

  afterEach(() => {
    delete (window as Record<string, unknown>).__grafanaImageRendererMessageChannel;
  });

  it('sends only success when there is no error', () => {
    sendRenderComplete(true);

    expect(messageChannelMock).toHaveBeenCalledWith(
      JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } })
    );
  });

  it('keeps success=false without an error as a plain message', () => {
    sendRenderComplete(false);

    expect(messageChannelMock).toHaveBeenCalledWith(
      JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: false } })
    );
  });

  it('attaches the failure reason', () => {
    sendRenderComplete(false, { status: 404, message: 'Dashboard not found' });

    expect(messageChannelMock).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'REPORT_RENDER_COMPLETE',
        data: { success: false, error: { status: 404, message: 'Dashboard not found' } },
      })
    );
  });

  it('does nothing when the page is not being captured', () => {
    delete (window as Record<string, unknown>).__grafanaImageRendererMessageChannel;

    expect(() => sendRenderComplete(false, { message: 'x' })).not.toThrow();
  });
});
