import { EventBus } from '@grafana/data';

import { getAppEvents } from '../appEvents';

import {
  closeExtensionSidebar,
  CloseExtensionSidebarEvent,
  openExtensionSidebar,
  OpenExtensionSidebarEvent,
} from './extensionSidebar';

jest.mock('../appEvents', () => ({
  getAppEvents: jest.fn(),
}));

describe('extensionSidebar', () => {
  let mockEventBus: EventBus;
  let mockPublish: jest.Mock;

  beforeEach(() => {
    mockPublish = jest.fn();
    mockEventBus = {
      publish: mockPublish,
    } as unknown as EventBus;

    jest.mocked(getAppEvents).mockReturnValue(mockEventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('openExtensionSidebar', () => {
    it('should publish OpenExtensionSidebarEvent with correct payload', () => {
      const pluginId = 'test-plugin';
      const componentTitle = 'Test Component';
      const props = { foo: 'bar', count: 42 };

      openExtensionSidebar(pluginId, componentTitle, props);

      expect(mockPublish).toHaveBeenCalledTimes(1);

      const publishedEvent = mockPublish.mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(OpenExtensionSidebarEvent);
      expect(publishedEvent.payload).toEqual({
        pluginId,
        componentTitle,
        props,
      });
    });

    it('should publish OpenExtensionSidebarEvent without props when props are not provided', () => {
      const pluginId = 'test-plugin';
      const componentTitle = 'Test Component';

      openExtensionSidebar(pluginId, componentTitle);

      expect(mockPublish).toHaveBeenCalledTimes(1);

      const publishedEvent = mockPublish.mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(OpenExtensionSidebarEvent);
      expect(publishedEvent.payload).toEqual({
        pluginId,
        componentTitle,
        props: undefined,
      });
    });

    it('should handle empty props object', () => {
      const pluginId = 'test-plugin';
      const componentTitle = 'Test Component';
      const props = {};

      openExtensionSidebar(pluginId, componentTitle, props);

      expect(mockPublish).toHaveBeenCalledTimes(1);

      const publishedEvent = mockPublish.mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(OpenExtensionSidebarEvent);
      expect(publishedEvent.payload).toEqual({
        pluginId,
        componentTitle,
        props,
      });
    });
  });

  describe('closeExtensionSidebar', () => {
    it('should publish CloseExtensionSidebarEvent', () => {
      closeExtensionSidebar();

      expect(mockPublish).toHaveBeenCalledTimes(1);

      const publishedEvent = mockPublish.mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(CloseExtensionSidebarEvent);
    });
  });

  describe('Event Classes', () => {
    it('OpenExtensionSidebarEvent should have correct type', () => {
      expect(OpenExtensionSidebarEvent.type).toBe('open-extension-sidebar');
    });

    it('CloseExtensionSidebarEvent should have correct type', () => {
      expect(CloseExtensionSidebarEvent.type).toBe('close-extension-sidebar');
    });

    it('OpenExtensionSidebarEvent should be instantiable with payload', () => {
      const payload = {
        pluginId: 'test-plugin',
        componentTitle: 'Test Component',
        props: { key: 'value' },
      };

      const event = new OpenExtensionSidebarEvent(payload);

      expect(event.payload).toEqual(payload);
      expect(event.type).toBe('open-extension-sidebar');
    });

    it('CloseExtensionSidebarEvent should be instantiable', () => {
      const event = new CloseExtensionSidebarEvent();

      expect(event.type).toBe('close-extension-sidebar');
    });
  });
});
