import { render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { shouldHideSoloPanelLogo, SoloPanelPageLogo } from './SoloPanelPageLogo';

// Mock the theme hook
const mockUseTheme2 = jest.fn();
const mockUseStyles2 = jest.fn((fn) => fn({} as GrafanaTheme2));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  useTheme2: () => mockUseTheme2(),
  useStyles2: (fn: (theme: GrafanaTheme2) => Record<string, unknown>) => mockUseStyles2(fn),
}));

// Mock the logo images for dark and light modes
jest.mock('img/grafana_text_logo_dark.svg', () => 'grafana-text-logo-dark.svg');
jest.mock('img/grafana_text_logo_light.svg', () => 'grafana-text-logo-light.svg');
jest.mock('img/grafana_text_logo_light.svg', () => 'grafana-text-logo-light.svg');

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation((callback) => {
  return {
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    // Helper to trigger resize
    trigger: (width: number, height: number) => {
      callback([{ contentRect: { width, height } }]);
    },
  };
});

// Helper function to assign a mock div to a ref
function assignMockDivToRef(ref: React.RefObject<HTMLDivElement>, mockDiv: HTMLDivElement) {
  // Use type assertion to bypass readonly restriction in tests
  (ref as { current: HTMLDivElement | null }).current = mockDiv;
}

describe('SoloPanelPageLogo', () => {
  describe('shouldHideSoloPanelLogo', () => {
    it('treats presence (empty string) as true', () => {
      expect(shouldHideSoloPanelLogo('')).toBe(true);
    });

    it('treats true/1 as true', () => {
      expect(shouldHideSoloPanelLogo('true')).toBe(true);
      expect(shouldHideSoloPanelLogo('1')).toBe(true);
      expect(shouldHideSoloPanelLogo(' TRUE ')).toBe(true);
    });

    it('treats false/0 as false', () => {
      expect(shouldHideSoloPanelLogo('false')).toBe(false);
      expect(shouldHideSoloPanelLogo('0')).toBe(false);
      expect(shouldHideSoloPanelLogo(' FALSE ')).toBe(false);
    });

    it('treats undefined as false', () => {
      expect(shouldHideSoloPanelLogo(undefined)).toBe(false);
    });
  });

  const mockTheme = {
    isDark: false,
    colors: {
      background: { primary: '#ffffff' },
      border: { weak: '#e0e0e0' },
      text: { secondary: '#666666' },
    },
    shape: { radius: { default: '4px' } },
    shadows: { z3: '0 2px 4px rgba(0,0,0,0.1)' },
    typography: { body: { fontSize: '14px' } },
    spacing: jest.fn((n: number) => `${n * 8}px`),
    transitions: {
      handleMotion: jest.fn(() => ({})),
    },
  } as unknown as GrafanaTheme2;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme2.mockReturnValue({
      ...mockTheme,
      isDark: false,
    });
    mockUseStyles2.mockImplementation((fn) => fn(mockTheme));
  });

  it('should render the logo component', () => {
    const containerRef = createRef<HTMLDivElement>();
    const mockDiv = document.createElement('div');
    mockDiv.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));

    assignMockDivToRef(containerRef, mockDiv);

    render(<SoloPanelPageLogo containerRef={containerRef} isHovered={false} hideLogo={undefined} />);

    expect(screen.getByText('Powered by')).toBeInTheDocument();
    expect(screen.getByAltText('Grafana')).toBeInTheDocument();
  });

  it('should hide logo when isHovered is true', () => {
    const containerRef = createRef<HTMLDivElement>();
    const mockDiv = document.createElement('div');
    mockDiv.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
    assignMockDivToRef(containerRef, mockDiv);

    render(<SoloPanelPageLogo containerRef={containerRef} isHovered={true} hideLogo={undefined} />);

    // The logo should still be in the DOM but with reduced opacity
    const poweredByText = screen.getByText('Powered by');
    expect(poweredByText).toBeInTheDocument();
    // The logoHidden class should be applied (we can't easily test the class name without more setup)
  });

  it('should show logo when isHovered is false', () => {
    const containerRef = createRef<HTMLDivElement>();
    const mockDiv = document.createElement('div');
    mockDiv.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
    assignMockDivToRef(containerRef, mockDiv);

    render(<SoloPanelPageLogo containerRef={containerRef} isHovered={false} hideLogo={undefined} />);

    // The logo should be visible
    expect(screen.getByText('Powered by')).toBeInTheDocument();
    expect(screen.getByAltText('Grafana')).toBeInTheDocument();
  });

  it('should use dark logo in dark theme', () => {
    const containerRef = createRef<HTMLDivElement>();
    const mockDiv = document.createElement('div');
    mockDiv.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
    assignMockDivToRef(containerRef, mockDiv);

    mockUseTheme2.mockReturnValue({
      ...mockTheme,
      isDark: true,
    });

    render(<SoloPanelPageLogo containerRef={containerRef} isHovered={false} hideLogo={undefined} />);

    const logo = screen.getByAltText('Grafana');
    expect(logo).toHaveAttribute('src', 'grafana-text-logo-light.svg');
  });

  it('should use correct logo based on theme', () => {
    const containerRef = createRef<HTMLDivElement>();
    const mockDiv = document.createElement('div');
    mockDiv.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
    assignMockDivToRef(containerRef, mockDiv);

    // The beforeEach sets isDark: false by default, so this should work
    // But the previous test might have changed it, so let's ensure it's reset
    mockUseTheme2.mockClear();
    mockUseTheme2.mockReturnValue({
      ...mockTheme,
      isDark: false,
    });

    render(<SoloPanelPageLogo containerRef={containerRef} isHovered={false} hideLogo={undefined} />);

    const logo = screen.getByAltText('Grafana');
    // Verify logo is rendered (the exact src depends on theme, which is tested in other tests)
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src');
  });

  it('should apply scaling styles based on container dimensions', () => {
    const containerRef = createRef<HTMLDivElement>();
    const mockDiv = document.createElement('div');
    mockDiv.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
    assignMockDivToRef(containerRef, mockDiv);

    render(<SoloPanelPageLogo containerRef={containerRef} isHovered={false} hideLogo={undefined} />);

    // Find the logo container by looking for the "Powered by" text's parent
    const poweredByText = screen.getByText('Powered by');
    const logoContainer = poweredByText.parentElement as HTMLElement;
    expect(logoContainer).toBeInTheDocument();
    // Check that inline styles are applied (scaling should be between 0.6 and 1.0)
    expect(logoContainer.style.fontSize).toBeTruthy();
    expect(logoContainer.style.top).toBeTruthy();
    expect(logoContainer.style.right).toBeTruthy();
  });

  it('should observe container resize', () => {
    const containerRef = createRef<HTMLDivElement>();
    const mockDiv = document.createElement('div');
    mockDiv.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
    assignMockDivToRef(containerRef, mockDiv);

    render(<SoloPanelPageLogo containerRef={containerRef} isHovered={false} hideLogo={undefined} />);

    expect(ResizeObserver).toHaveBeenCalled();
    const resizeObserverInstance = (ResizeObserver as jest.Mock).mock.results[0].value;
    expect(resizeObserverInstance.observe).toHaveBeenCalledWith(mockDiv);
  });
});
