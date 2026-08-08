import { render, screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { TextDimensionMode } from '@grafana/schema';
import { mockThemeContext } from '@grafana/ui';
import { HttpRequestMethod } from 'app/plugins/panel/canvas/panelcfg.gen';

import { type CanvasElementOptions } from '../element';
import { Align } from '../types';

import { buttonItem, defaultApiConfig, defaultStyleConfig } from './button';
import { createMockDimensionContext } from './testHelpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prepareData = buttonItem.prepareData!;
const ButtonDisplay = buttonItem.display;

describe('buttonItem', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  describe('exported defaults', () => {
    it('defaultApiConfig defaults to a POST JSON request', () => {
      expect(defaultApiConfig.method).toBe(HttpRequestMethod.POST);
      expect(defaultApiConfig.contentType).toBe('application/json');
    });

    it('defaultStyleConfig defaults to the primary variant', () => {
      expect(defaultStyleConfig.variant).toBe('primary');
    });
  });

  describe('prepareData', () => {
    it('fills api method/contentType from defaults and resolves text', () => {
      const ctx = createMockDimensionContext({ text: 'Go' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: CanvasElementOptions<any> = {
        name: 'el',
        type: 'button',
        config: {
          text: { mode: TextDimensionMode.Fixed, fixed: 'Go' },
          align: Align.Center,
          api: { endpoint: 'http://example.com' },
        },
      };

      const data = prepareData(ctx, options);

      expect(data.text).toBe('Go');
      expect(data.api?.method).toBe(defaultApiConfig.method);
      expect(data.api?.contentType).toBe(defaultApiConfig.contentType);
      expect(data.style).toEqual(defaultStyleConfig);
    });

    it('leaves api undefined and falls back to the default style when config is empty', () => {
      const ctx = createMockDimensionContext();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = prepareData(ctx, { name: 'el', type: 'button', config: undefined } as CanvasElementOptions<any>);

      expect(data.api).toBeUndefined();
      expect(data.style).toEqual(defaultStyleConfig);
      expect(data.align).toBe(Align.Center);
      expect(data.size).toBe(14);
    });
  });

  describe('getNewOptions', () => {
    it('produces defaults with the api and style configs', () => {
      const options = buttonItem.getNewOptions();

      expect(options.config?.api).toEqual(defaultApiConfig);
      expect(options.config?.style).toEqual(defaultStyleConfig);
      expect(options.config?.align).toBe(Align.Center);
      expect(options.background?.color?.fixed).toBe('transparent');
      expect(options.placement?.rotation).toBe(0);
    });
  });

  describe('display', () => {
    it('renders a button showing the text', () => {
      render(<ButtonDisplay config={{ align: Align.Center }} data={{ text: 'Click me', align: Align.Center }} />);
      expect(screen.getByRole('button')).toHaveTextContent('Click me');
    });
  });
});
