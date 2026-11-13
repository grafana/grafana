import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, type LinkModel } from '@grafana/data';

import { VizTooltipContainer } from './VizTooltipContainer';
import { VizTooltipFooter } from './VizTooltipFooter';
import { VizTooltipWrapper } from './VizTooltipWrapper';

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

it('limits positioned tooltip surfaces to 800px and the viewport', () => {
  render(
    <VizTooltipContainer position={{ x: 0, y: 0 }} offset={{ x: 0, y: 0 }}>
      <span>Tooltip content</span>
    </VizTooltipContainer>
  );
  expect(screen.getByText('Tooltip content').parentElement).toHaveStyle({
    maxWidth: 'min(800px, calc(100vw - 32px))',
  });
});
