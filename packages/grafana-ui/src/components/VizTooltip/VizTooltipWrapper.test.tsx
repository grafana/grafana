import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, type LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { VizTooltipContainer } from './VizTooltipContainer';
import { VizTooltipFooter } from './VizTooltipFooter';
import { VizTooltipRow } from './VizTooltipRow';
import { VizTooltipWrapper } from './VizTooltipWrapper';
import { type VizTooltipSize } from './types';

const WRAPPER_TESTID = selectors.components.Panels.Visualization.Tooltip.Wrapper;

// `narrow` is intentionally capped at the theme's `sm` breakpoint rather than a magic pixel value, so
// the expectation is derived from the same theme the component renders with: changing the breakpoint
// value must not break this test, but pointing `narrow` at a different token should.
const narrowMaxWidth = `min(${createTheme().breakpoints.values.sm}px, calc(100vw - 32px))`;

const links: LinkModel[] = [
  { title: 'First link', href: '#first', origin: {}, target: '_self', onClick: jest.fn() },
  { title: 'Second link', href: '#second', origin: {}, target: '_self', onClick: jest.fn() },
];

beforeEach(() => jest.clearAllMocks());

it('keeps links and actions on one viewport-constrained surface', () => {
  render(
    <VizTooltipWrapper data-testid="surface">
      <VizTooltipFooter
        dataLinks={links}
        actions={[{ title: 'Run action', onClick: jest.fn(), confirmation: jest.fn(), style: {} }]}
      />
    </VizTooltipWrapper>
  );

  const surface = screen.getByTestId('surface');
  expect(surface).toHaveStyle({
    background: createTheme().colors.background.elevated,
    maxHeight: 'calc(100vh - 32px)',
    maxWidth: 'calc(100vw - 32px)',
    overflowY: 'auto',
  });
  expect(surface).toContainElement(screen.getByRole('menuitem', { name: 'First link' }));
  expect(surface).toContainElement(screen.getByRole('button', { name: 'Run action' }));
  const menu = screen.getByRole('menu');
  // JSDOM does not resolve selector specificity against Box's later-inserted styles.
  const menuRule = Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule && rule.selectorText.endsWith('>[role="menu"]') && menu.matches(rule.selectorText)
    );
  expect(menuRule?.style.getPropertyValue('border')).toBe('none');
  expect(menuRule?.style.getPropertyValue('box-shadow')).toBe('none');
  expect(menuRule?.style.getPropertyValue('display')).toBe('block');
  expect(menuRule?.style.getPropertyValue('max-width')).toBe('100%');
});

it('does not steal focus on hover, but supports tabbing into links and arrow navigation', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<button>Outside</button>);
  await user.click(screen.getByRole('button', { name: 'Outside' }));
  rerender(
    <>
      <button>Outside</button>
      <VizTooltipWrapper>
        <VizTooltipFooter dataLinks={links} />
      </VizTooltipWrapper>
    </>
  );

  expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('menuitem', { name: 'First link' })).toHaveFocus();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'Second link' })).toHaveFocus();
  await user.keyboard(' ');
  expect(links[1].onClick).toHaveBeenCalledTimes(1);
});

it('forwards menu callbacks through nested wrappers without adding a second surface', async () => {
  const user = userEvent.setup();
  const onOpen = jest.fn();
  const onClose = jest.fn();
  const onKeyDownCapture = jest.fn();
  render(
    <VizTooltipWrapper menuProps={{ autoFocus: true, onOpen, onClose, onKeyDownCapture }}>
      <VizTooltipWrapper data-testid="content">
        <VizTooltipFooter dataLinks={links} />
      </VizTooltipWrapper>
    </VizTooltipWrapper>
  );

  expect(screen.getByRole('menuitem', { name: 'First link' })).toHaveFocus();
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('content')).not.toHaveStyle({ background: createTheme().colors.background.elevated });
  await user.keyboard('{Escape}');
  expect(onKeyDownCapture).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('lets a caller intercept a menu key before default handling', async () => {
  render(
    <VizTooltipWrapper
      menuProps={{
        autoFocus: true,
        onKeyDownCapture: (event) => {
          event.preventDefault();
          event.stopPropagation();
        },
      }}
    >
      <VizTooltipFooter dataLinks={links} />
    </VizTooltipWrapper>
  );

  await userEvent.keyboard('{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'First link' })).toHaveFocus();
  expect(links[0].onClick).not.toHaveBeenCalled();
});

it('limits positioned tooltip width without introducing an outer scroll container', () => {
  render(
    <VizTooltipContainer position={{ x: 0, y: 0 }} offset={{ x: 0, y: 0 }}>
      <span>Tooltip content</span>
    </VizTooltipContainer>
  );
  expect(screen.getByText('Tooltip content').parentElement).toHaveStyle({
    maxWidth: 'min(800px, calc(100vw - 32px))',
    overflowY: 'hidden',
  });
});

it('uses zero-specificity defaults so consumer classes can override the surface', () => {
  render(
    <VizTooltipContainer position={{ x: 0, y: 0 }} offset={{ x: 0, y: 0 }}>
      <span>Custom tooltip</span>
    </VizTooltipContainer>
  );
  const surface = screen.getByText('Custom tooltip').parentElement!;
  const rules = Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        Array.from(surface.classList).some(
          (name) => rule.selectorText === `.${name}` || rule.selectorText === `*:where(.${name})`
        )
    );
  expect(rules.some((rule) => rule.style.getPropertyValue('padding') === '8px')).toBe(true);
  expect(rules.some((rule) => rule.style.getPropertyValue('background'))).toBe(true);
  expect(rules.every((rule) => rule.selectorText.startsWith('*:where('))).toBe(true);
});

describe('VizTooltipWrapper', () => {
  describe('size prop', () => {
    it('caps the tooltip width at the theme sm breakpoint when size is narrow', () => {
      render(<VizTooltipWrapper size="narrow">content</VizTooltipWrapper>);
      expect(screen.getByTestId(WRAPPER_TESTID)).toHaveStyle({ maxWidth: narrowMaxWidth });
    });

    it.each([
      { desc: 'auto', size: 'auto' as const },
      { desc: 'the default (size prop omitted)', size: undefined },
    ])('leaves the tooltip width uncapped when size is $desc', ({ size }: { desc: string; size?: VizTooltipSize }) => {
      render(<VizTooltipWrapper size={size}>content</VizTooltipWrapper>);
      const wrapper = screen.getByTestId(WRAPPER_TESTID);
      expect(wrapper).toHaveTextContent('content');
      expect(wrapper).not.toHaveStyle({ maxWidth: narrowMaxWidth });
    });
  });

  // The wrapper provides its size through context; descendant rows flip which cell absorbs the
  // slack. Rendering the real wrapper + row tree (rather than the context directly) exercises that
  // wiring the way consumers hit it.
  describe('size propagation to descendant rows', () => {
    // The inline label/value sit inside the wrapper divs that carry the width constraints, so reach
    // those wrappers via the rendered text rather than coupling to generated class names.
    const labelWrapperOf = (labelText: string) => screen.getByText(labelText).parentElement;
    const valueWrapperOf = (valueText: string) => screen.getByText(valueText).parentElement;

    it('caps the label name at 75% and floors the value at 25% of the width when size is narrow', () => {
      const value = 'a long value that should wrap rather than widen the tooltip';
      render(
        <VizTooltipWrapper size="narrow">
          <VizTooltipRow label="My Label" value={value} />
        </VizTooltipWrapper>
      );
      expect(labelWrapperOf('My Label')).toHaveStyle({ maxWidth: '75%' });
      // value keeps a 25% floor and stays right-aligned within its cell, matching the auto layout
      expect(valueWrapperOf(value)).toHaveStyle({ minWidth: '25%', justifyContent: 'flex-end' });
    });

    it('leaves the label uncapped and the value holding its width when size is auto', () => {
      render(
        <VizTooltipWrapper size="auto">
          <VizTooltipRow label="My Label" value="My Value" />
        </VizTooltipWrapper>
      );
      // auto grows to fit: the value holds its width (does not shrink) and neither cell is % bound.
      expect(valueWrapperOf('My Value')).toHaveStyle({ flexShrink: 0 });
      expect(labelWrapperOf('My Label')).not.toHaveStyle({ maxWidth: '75%' });
      expect(valueWrapperOf('My Value')).not.toHaveStyle({ minWidth: '25%' });
    });
  });
});
