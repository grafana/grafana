import { screen, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useToggle } from 'react-use';

import { EventBusSrv, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { ElementSelectionContext } from '../ElementSelectionContext/ElementSelectionContext';

import { PanelChrome, type PanelChromeProps } from './PanelChrome';
import { type PanelChromeHeaderControls, PanelChromeHeaderControlsContext } from './PanelChromeHeaderControlsContext';
import { PanelContextProvider } from './PanelContext';

const setup = (propOverrides?: Partial<PanelChromeProps>) => {
  const props: PanelChromeProps = {
    width: 100,
    height: 100,
    children: (innerWidth, innerHeight) => {
      return <div style={{ width: innerWidth, height: innerHeight, color: 'pink' }}>Panel&apos;s Content</div>;
    },
  };

  Object.assign(props, propOverrides);
  return {
    ...render(<PanelChrome {...props} />),
    user: userEvent.setup(),
  };
};

const setupWithToggleCollapsed = (propOverrides?: Partial<PanelChromeProps>) => {
  const props: PanelChromeProps = {
    width: 100,
    height: 100,
    children: (innerWidth, innerHeight) => {
      return <div style={{ width: innerWidth, height: innerHeight, color: 'pink' }}>Panel&apos;s Content</div>;
    },
    collapsible: true,
  };

  Object.assign(props, propOverrides);

  const ControlledCollapseComponent = () => {
    const [collapsed, toggleCollapsed] = useToggle(false);

    return <PanelChrome {...props} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />;
  };

  return {
    ...render(<ControlledCollapseComponent />),
    user: userEvent.setup(),
  };
};

it('renders an empty panel with required props only', () => {
  setup();

  expect(screen.getByText("Panel's Content")).toBeInTheDocument();
});

it('caps a panel with no height at maxHeight, handing children the inner height the cap leaves', () => {
  const children = jest.fn((_innerWidth: number, _innerHeight: number) => null);
  setup({ height: undefined, maxHeight: 300, children });

  const [, innerHeight] = children.mock.lastCall!;
  expect(innerHeight).toBeGreaterThan(0);
  expect(innerHeight).toBeLessThan(300);
});

it('renders a panel with subtitle and title', () => {
  setup({ title: 'A', subtitle: 'B' });

  expect(screen.getByText("Panel's Content").parentElement).toHaveStyle({ padding: '0px 8px 8px 8px' });
});

it('renders an empty panel without padding', () => {
  setup({ padding: 'none' });

  expect(screen.getByText("Panel's Content").parentElement).toHaveStyle({ padding: '0px 0px 0px 0px' });
});

it('renders an empty panel with padding', () => {
  setup({ padding: 'md' });

  expect(screen.getByText("Panel's Content").style.getPropertyValue('height')).not.toBe('100px');
  expect(screen.getByText("Panel's Content").parentElement).not.toHaveStyle({ padding: '0px' });
});

// Check for backwards compatibility
it('renders panel header if prop title', () => {
  setup({ title: 'Test Panel Header' });

  expect(screen.getByTestId(selectors.components.Panels.Panel.headerContainer)).toBeInTheDocument();
});

// Check for backwards compatibility
it('renders panel with title in place if prop title', () => {
  setup({ title: 'Test Panel Header' });

  expect(screen.getByText('Test Panel Header')).toBeInTheDocument();
});

// Check for backwards compatibility
it('renders panel with a header if prop leftItems', () => {
  setup({
    leftItems: [<div key="left-item-test"> This should be a self-contained node </div>],
  });

  expect(screen.getByTestId(selectors.components.Panels.Panel.headerContainer)).toBeInTheDocument();
});

it('renders panel with a hovering header if prop hoverHeader is true', () => {
  setup({ title: 'Test Panel Header', hoverHeader: true });

  expect(screen.queryByTestId(selectors.components.Panels.Panel.headerContainer)).not.toBeInTheDocument();
});

it('renders panel with a header if prop titleItems', () => {
  setup({
    titleItems: [<div key="title-item-test"> This should be a self-contained node </div>],
  });

  expect(screen.getByTestId(selectors.components.Panels.Panel.headerContainer)).toBeInTheDocument();
});

it('renders panel with a header with icons in place if prop titleItems', () => {
  setup({
    titleItems: [<div key="title-item-test"> This should be a self-contained node </div>],
  });

  expect(screen.getByTestId('title-items-container')).toBeInTheDocument();
});

it('renders panel with a show-on-hover menu icon if prop menu', () => {
  setup({ menu: <div> Menu </div> });

  expect(screen.getByTestId('panel-menu-button')).toBeInTheDocument();
  expect(screen.getByTestId('panel-menu-button')).not.toBeVisible();
});

it('renders panel with an always visible menu icon if prop showMenuAlways is true', () => {
  setup({ menu: <div> Menu </div>, showMenuAlways: true });

  expect(screen.getByTestId('panel-menu-button')).toBeInTheDocument();
  expect(screen.getByTestId('panel-menu-button')).toBeVisible();
});

describe('when the header controls are provided from outside the panel', () => {
  const renderWithHeaderControls = (controls: PanelChromeHeaderControls, propOverrides: Partial<PanelChromeProps>) => {
    const props: PanelChromeProps = {
      width: 100,
      height: 100,
      children: () => <div>Panel&apos;s Content</div>,
    };
    Object.assign(props, propOverrides);

    return render(
      <PanelChromeHeaderControlsContext.Provider value={controls}>
        <PanelChrome {...props} />
      </PanelChromeHeaderControlsContext.Provider>
    );
  };

  it('does not render the menu button in the panel header', () => {
    renderWithHeaderControls({ external: true, hoverSlot: null }, { title: 'Titled', menu: <div>Menu</div> });

    expect(screen.getByText('Titled')).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.Panels.Panel.menu('Titled'))).not.toBeInTheDocument();
  });

  it('renders the hover header items into the hover slot instead of the hover widget', () => {
    const hoverSlot = document.createElement('div');
    document.body.appendChild(hoverSlot);

    renderWithHeaderControls(
      { external: true, hoverSlot },
      {
        hoverHeader: true,
        menu: <div>Menu</div>,
        dragClass: 'drag-handle',
        titleItems: <span>Panel links</span>,
      }
    );

    const slot = within(hoverSlot);
    expect(slot.getByText('Panel links')).toBeInTheDocument();
    expect(slot.getByTestId(selectors.components.Panels.Panel.HoverWidget.dragIcon)).toHaveClass('drag-handle');
    expect(screen.queryByTestId('panel-menu-button')).not.toBeInTheDocument();
    expect(hoverSlot.querySelector('.show-on-hover')).toBeNull();

    hoverSlot.remove();
  });

  it('renders the drag handle into the drag handle slot, apart from the other hover header items', () => {
    const hoverSlot = document.createElement('div');
    const dragHandleSlot = document.createElement('div');
    document.body.append(hoverSlot, dragHandleSlot);

    renderWithHeaderControls(
      { external: true, hoverSlot, dragHandleSlot },
      { hoverHeader: true, dragClass: 'drag-handle', titleItems: <span>Panel links</span> }
    );

    expect(within(hoverSlot).getByText('Panel links')).toBeInTheDocument();
    expect(
      within(hoverSlot).queryByTestId(selectors.components.Panels.Panel.HoverWidget.dragIcon)
    ).not.toBeInTheDocument();
    expect(within(dragHandleSlot).getByTestId(selectors.components.Panels.Panel.HoverWidget.dragIcon)).toHaveClass(
      'drag-handle'
    );

    hoverSlot.remove();
    dragHandleSlot.remove();
  });

  it('renders nothing into the hover slot when the drag handle is its only item and has a slot of its own', () => {
    const hoverSlot = document.createElement('div');
    const dragHandleSlot = document.createElement('div');
    document.body.append(hoverSlot, dragHandleSlot);

    renderWithHeaderControls(
      { external: true, hoverSlot, dragHandleSlot },
      { hoverHeader: true, dragClass: 'drag-handle' }
    );

    expect(hoverSlot).toBeEmptyDOMElement();
    expect(
      within(dragHandleSlot).getByTestId(selectors.components.Panels.Panel.HoverWidget.dragIcon)
    ).toBeInTheDocument();

    hoverSlot.remove();
    dragHandleSlot.remove();
  });

  it('leaves out the drag handle when hideDragHandle is set', () => {
    const hoverSlot = document.createElement('div');
    document.body.appendChild(hoverSlot);

    renderWithHeaderControls(
      { external: true, hoverSlot, hideDragHandle: true },
      { hoverHeader: true, dragClass: 'drag-handle', titleItems: <span>Panel links</span> }
    );

    expect(within(hoverSlot).getByText('Panel links')).toBeInTheDocument();
    expect(
      within(hoverSlot).queryByTestId(selectors.components.Panels.Panel.HoverWidget.dragIcon)
    ).not.toBeInTheDocument();

    hoverSlot.remove();
  });

  it('offers stopping a stream from the hover slot when the panel has no other header items', async () => {
    const hoverSlot = document.createElement('div');
    document.body.appendChild(hoverSlot);
    const onCancelQuery = jest.fn();

    renderWithHeaderControls(
      { external: true, hoverSlot, hideDragHandle: true },
      { hoverHeader: true, dragClass: 'drag-handle', loadingState: LoadingState.Streaming, onCancelQuery }
    );

    await userEvent.click(within(hoverSlot).getByRole('button'));

    expect(onCancelQuery).toHaveBeenCalledTimes(1);

    hoverSlot.remove();
  });

  it('renders no hover header items while there is no hover slot', () => {
    renderWithHeaderControls(
      { external: true, hoverSlot: null },
      { hoverHeader: true, menu: <div>Menu</div>, titleItems: <span>Panel links</span> }
    );

    expect(screen.queryByText('Panel links')).not.toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.Panels.Panel.HoverWidget.container)).not.toBeInTheDocument();
  });
});

describe('when the panel host shows its series limit control', () => {
  const renderUntitled = (isSeriesLimitShown: boolean, headerControls?: PanelChromeHeaderControls) =>
    render(
      <PanelContextProvider
        value={{ eventsScope: 'global', eventBus: new EventBusSrv(), isSeriesLimitShown: () => isSeriesLimitShown }}
      >
        <PanelChromeHeaderControlsContext.Provider value={headerControls}>
          <PanelChrome width={100} height={100} hoverHeader titleItems={<button>Show all 5</button>}>
            {() => <div>Panel&apos;s Content</div>}
          </PanelChrome>
        </PanelChromeHeaderControlsContext.Provider>
      </PanelContextProvider>
    );

  it('shows the header of a panel without a title, with the control in it', () => {
    renderUntitled(true);

    const header = screen.getByTestId(selectors.components.Panels.Panel.headerContainer);
    expect(within(header).getByRole('button', { name: 'Show all 5' })).toBeInTheDocument();
  });

  it('renders the header instead of the hover slot when the header controls are provided from outside', () => {
    const hoverSlot = document.createElement('div');
    document.body.appendChild(hoverSlot);

    renderUntitled(true, { external: true, hoverSlot });

    const header = screen.getByTestId(selectors.components.Panels.Panel.headerContainer);
    expect(within(header).getByRole('button', { name: 'Show all 5' })).toBeInTheDocument();
    expect(hoverSlot).toBeEmptyDOMElement();

    hoverSlot.remove();
  });

  it('keeps the hover header while the series limit control is not shown', () => {
    renderUntitled(false);

    expect(screen.getByTestId(selectors.components.Panels.Panel.HoverWidget.container)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.Panels.Panel.headerContainer)).not.toBeInTheDocument();
  });
});

it('renders error status in the panel header if any given', () => {
  setup({ statusMessage: 'Error test' });

  expect(screen.getByLabelText('Panel status')).toBeInTheDocument();
});

it('does not render error status in the panel header if loadingState is error, but no statusMessage', () => {
  setup({ loadingState: LoadingState.Error, statusMessage: '' });

  expect(screen.queryByTestId('panel-status')).not.toBeInTheDocument();
});

it('renders loading indicator in the panel header if loadingState is loading', () => {
  setup({ loadingState: LoadingState.Loading });

  expect(screen.getByLabelText('Panel loading bar')).toBeInTheDocument();
});

it('renders loading indicator in the panel header if loadingState is loading regardless of not having a header', () => {
  setup({ loadingState: LoadingState.Loading, hoverHeader: true });

  expect(screen.getByLabelText('Panel loading bar')).toBeInTheDocument();
});

it('renders loading indicator in the panel header if loadingState is loading regardless of having a header', () => {
  setup({ loadingState: LoadingState.Loading, hoverHeader: false });

  expect(screen.getByLabelText('Panel loading bar')).toBeInTheDocument();
});

it('renders streaming indicator in the panel header if loadingState is streaming', () => {
  setup({ loadingState: LoadingState.Streaming });

  expect(screen.getByTestId('panel-streaming')).toBeInTheDocument();
});

it('collapses the controlled panel when user clicks on the chevron or the title', async () => {
  const { user } = setupWithToggleCollapsed({ title: 'Default title' });

  expect(screen.getByText("Panel's Content")).toBeInTheDocument();

  const button = screen.getByRole('button', { name: 'Default title' });
  const content = screen.getByTestId(selectors.components.Panels.Panel.content);
  // collapse button should have same aria-controls as the panel's content
  expect(button).toHaveAttribute('aria-controls', content.id);

  await user.click(button);

  expect(screen.queryByText("Panel's Content")).not.toBeInTheDocument();
  // aria-controls should be removed when panel is collapsed
  expect(button).not.toHaveAttribute('aria-controlls');
  expect(screen.queryByTestId(selectors.components.Panels.Panel.content)?.id).toBe(undefined);
});

it('collapses the uncontrolled panel when user clicks on the chevron or the title', async () => {
  const { user } = setup({ title: 'Default title', collapsible: true });

  expect(screen.getByText("Panel's Content")).toBeInTheDocument();

  const button = screen.getByRole('button', { name: 'Default title' });
  const content = screen.getByTestId(selectors.components.Panels.Panel.content);

  // collapse button should have same aria-controls as the panel's content
  expect(button).toHaveAttribute('aria-controls', content.id);

  await user.click(button);
  expect(screen.queryByText("Panel's Content")).not.toBeInTheDocument();
  // aria-controls should be removed when panel is collapsed
  expect(button).not.toHaveAttribute('aria-controlls');
  expect(screen.queryByTestId(selectors.components.Panels.Panel.content)?.id).toBe(undefined);
});

it('renders panel with a header if prop subHeaderContent', () => {
  setup({
    subHeaderContent: <div key="sub-header-test">This should be a sub-header node</div>,
  });

  expect(screen.getByTestId(selectors.components.Panels.Panel.headerContainer)).toBeInTheDocument();
});

it('renders panel with sub-header content in place if prop subHeaderContent', () => {
  setup({
    subHeaderContent: <div key="sub-header-test">This should be a sub-header node</div>,
  });

  expect(screen.getByText('This should be a sub-header node')).toBeInTheDocument();
});

it('does not render sub-header content when panel is collapsed', () => {
  setup({
    title: 'Test Panel',
    collapsible: true,
    collapsed: true,
    subHeaderContent: <div key="sub-header-test">This should be a sub-header node</div>,
  });

  expect(screen.queryByText('This should be a sub-header node')).not.toBeInTheDocument();
});

it('does not select the panel when clicking interactive content', async () => {
  const onSelect = jest.fn();
  const user = userEvent.setup();

  render(
    <ElementSelectionContext.Provider
      value={{
        enabled: true,
        selected: [],
        onSelect,
        onClear: jest.fn(),
      }}
    >
      <PanelChrome width={100} height={100} selectionId="panel-1">
        {() => (
          <div>
            <button type="button">Button text</button>
            <input role="combobox" />
            {/* eslint-disable-next-line @grafana/no-plain-links */}
            <a href="#">Anchor text</a>
            <canvas />
            <svg />
            <div className="u-over" />
            <div className="u-axis" />
            <div role="button" />
            <div role="columnheader">Column header</div>
            <div>Non-interactive</div>
          </div>
        )}
      </PanelChrome>
      <div id="grafana-portal-container">
        <div />
      </div>
    </ElementSelectionContext.Provider>
  );

  await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('combobox') });
  expect(onSelect).not.toHaveBeenCalled();

  await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: 'Button text' }) });
  expect(onSelect).not.toHaveBeenCalled();

  await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('link', { name: 'Anchor text' }) });
  expect(onSelect).not.toHaveBeenCalled();

  await user.pointer({ keys: '[MouseLeft>]', target: document.querySelector('canvas')! });
  expect(onSelect).not.toHaveBeenCalled();

  await user.pointer({ keys: '[MouseLeft>]', target: document.querySelector('svg')! });
  expect(onSelect).not.toHaveBeenCalled();

  await user.pointer({ keys: '[MouseLeft>]', target: document.querySelector('.u-over')! });
  expect(onSelect).not.toHaveBeenCalled();

  await user.pointer({ keys: '[MouseLeft>]', target: document.querySelector('div[role="button"]')! });
  expect(onSelect).not.toHaveBeenCalled();

  await user.pointer({ keys: '[MouseLeft>]', target: document.querySelector('.u-axis')! });
  expect(onSelect).not.toHaveBeenCalled();

  await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('columnheader', { name: 'Column header' }) });
  expect(onSelect).not.toHaveBeenCalled();

  await user.pointer({ keys: '[MouseLeft>]', target: screen.getByText('Non-interactive') });
  expect(onSelect).toHaveBeenCalledTimes(1);
});
