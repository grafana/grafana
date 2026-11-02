import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, type ThemeTypographyVariantTypes } from '@grafana/data';

import { Text } from './Text';

let resizeObserverCallback: ResizeObserverCallback;
let originalResizeObserver: typeof ResizeObserver;

beforeEach(() => {
  originalResizeObserver = global.ResizeObserver;
  global.ResizeObserver = class ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resizeObserverCallback = callback;
    }

    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  global.ResizeObserver = originalResizeObserver;
});

describe('Text', () => {
  it('renders correctly', () => {
    render(<Text element={'h1'}>This is a text component</Text>);
    expect(screen.getByText('This is a text component')).toBeInTheDocument();
  });

  it('keeps the element type but changes its styles', () => {
    const customVariant: keyof ThemeTypographyVariantTypes = 'body';
    render(
      <Text element={'h1'} variant={customVariant}>
        This is a text component
      </Text>
    );
    const theme = createTheme();
    const textComponent = screen.getByRole('heading');
    expect(textComponent).toBeInTheDocument();
    expect(textComponent).toHaveStyle(`fontSize: ${theme.typography.body.fontSize}`);
  });

  it('has the selected colour', () => {
    const customColor = 'info';
    const theme = createTheme();
    render(
      <Text element={'h1'} color={customColor}>
        This is a text component
      </Text>
    );
    const textComponent = screen.getByRole('heading');
    expect(textComponent).toHaveStyle(`color:${theme.colors.info.text}`);
  });

  it('renders the tooltip when truncated and handles content changes', async () => {
    const firstValue = 'first long title';
    const secondValue = 'second long title';

    const { rerender } = render(
      <Text element="p" truncate>
        {firstValue}
      </Text>
    );

    const textElement = screen.getByText(firstValue);

    Object.defineProperties(textElement, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 200 },
    });

    await act(async () => {
      resizeObserverCallback([{ target: textElement } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    });

    await userEvent.hover(screen.getByText(firstValue));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(firstValue);

    rerender(
      <Text element="p" truncate>
        {secondValue}
      </Text>
    );

    expect(await screen.findByRole('tooltip')).toHaveTextContent(secondValue);
  });
});
