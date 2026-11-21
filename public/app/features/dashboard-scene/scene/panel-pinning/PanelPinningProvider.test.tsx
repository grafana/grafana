import { Fragment, StrictMode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { of } from 'rxjs';
import { act, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { setGetObservablePluginLinks } from '@grafana/runtime/internal';
import { LocalValueVariable, VizPanel, VizPanelMenu } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';
import { panelMenuBehavior } from '../PanelMenuBehavior';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { getPanelPinning } from './PanelPinning';
import { PanelPinningProvider, PinnablePanel, PinnedPanelDock } from './PanelPinningProvider';

function SearchContents({ variable, onMount }: { variable: LocalValueVariable; onMount: () => void }) {
  const [text, setText] = useState('');
  const { value } = variable.useState();
  useEffect(onMount, [onMount]);
  return (
    <>
      <label>
        Search
        <input value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <span>Region: {String(value)}</span>
    </>
  );
}

function MountMeasurement({ onMeasure }: { onMeasure: (connected: boolean) => void }) {
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => onMeasure(element.current!.isConnected), [onMeasure]);
  return <div ref={element}>Measured panel</div>;
}

function setup(available = true) {
  const menu = new VizPanelMenu({ $behaviors: [panelMenuBehavior] });
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', menu });
  const dashboard = new DashboardScene({ title: 'Operations', body: DefaultGridLayoutManager.fromVizPanels([panel]) });
  const variable = new LocalValueVariable({ name: 'region', value: 'east', text: 'east' });
  const onMount = jest.fn();
  const tree = (enabled = true, visible = true) => (
    <PanelPinningProvider dashboard={dashboard} enabled={enabled} available={available}>
      <PinnedPanelDock />
      {visible && (
        <PinnablePanel panel={panel}>
          <SearchContents variable={variable} onMount={onMount} />
        </PinnablePanel>
      )}
    </PanelPinningProvider>
  );
  const result = render(tree());
  return { ...result, dashboard, menu, panel, variable, onMount, tree };
}

describe('panel pinning', () => {
  beforeAll(() => setGetObservablePluginLinks(() => of([])));
  it.each([false, true])('attaches the portal before child layout effects run (Strict Mode: %s)', (strict) => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
    const dashboard = new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([panel]) });
    const onMeasure = jest.fn();
    const Wrapper = strict ? StrictMode : Fragment;
    render(
      <Wrapper>
        <PanelPinningProvider dashboard={dashboard} enabled>
          <PinnedPanelDock />
          <PinnablePanel panel={panel}>
            <MountMeasurement onMeasure={onMeasure} />
          </PinnablePanel>
        </PanelPinningProvider>
      </Wrapper>
    );
    expect(onMeasure).toHaveBeenCalled();
    expect(onMeasure.mock.calls.every(([connected]) => connected)).toBe(true);
    expect(screen.getByText('Measured panel')).toBeVisible();
  });

  it('keeps input state, focus, and variable updates when pinning and unpinning the original panel', async () => {
    const { panel, dashboard, variable, onMount } = setup();
    const input = screen.getByRole('textbox', { name: 'Search' });
    await userEvent.type(input, 'production');
    const pinning = getPanelPinning(dashboard)!;
    act(() => pinning.pin(panel));
    const dock = screen.getByRole('region', { name: 'Pinned panel' });

    expect(within(dock).getByRole('textbox', { name: 'Search' })).toBe(input);
    expect(input).toHaveValue('production');
    expect(input).toHaveFocus();
    act(() => variable.setState({ value: 'west', text: 'west' }));
    expect(within(dock).getByText('Region: west')).toBeInTheDocument();

    act(() => pinning.unpin());
    expect(screen.getByRole('textbox', { name: 'Search' })).toBe(input);
    expect(input).toHaveValue('production');
    expect(input).toHaveFocus();
    expect(screen.getByText('Region: west')).toBeInTheDocument();
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it('offers pin and unpin actions through the real panel menu', async () => {
    const { menu, dashboard } = setup();
    let release: () => void;
    act(() => {
      release = menu.activate();
    });
    await waitFor(() => expect(menu.state.items?.map((item) => item.text)).toContain('Pin to top'));
    act(() => menu.state.items?.find((item) => item.text === 'Pin to top')?.onClick?.({} as React.MouseEvent));
    expect(screen.getByRole('region', { name: 'Pinned panel' })).toBeVisible();
    act(() => {
      release();
      release = menu.activate();
    });
    await waitFor(() => expect(menu.state.items?.map((item) => item.text)).toContain('Unpin panel'));
    act(() => menu.state.items?.find((item) => item.text === 'Unpin panel')?.onClick?.({} as React.MouseEvent));
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeVisible();
    expect(getPanelPinning(dashboard)!.getSnapshot()).toBeNull();
    act(() => release());
  });

  it('leaves normal panel rendering and menus unchanged when the experiment is disabled', async () => {
    const { menu, dashboard } = setup(false);
    let release: () => void;
    act(() => {
      release = menu.activate();
    });
    await waitFor(() => expect(menu.state.items?.map((item) => item.text)).toContain('View'));
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeVisible();
    expect(menu.state.items?.map((item) => item.text)).not.toContain('Pin to top');
    expect(getPanelPinning(dashboard)).toBeUndefined();
    act(() => release());
  });

  it('unpins through the dock control and returns focus to the original panel', async () => {
    const { panel, dashboard } = setup();
    const input = screen.getByRole('textbox', { name: 'Search' });
    act(() => getPanelPinning(dashboard)!.pin(panel));
    await userEvent.click(screen.getByRole('button', { name: 'Unpin panel' }));
    expect(screen.getByRole('textbox', { name: 'Search' })).toBe(input);
    expect(getPanelPinning(dashboard)!.getSnapshot()).toBeNull();
    await waitFor(() => expect(getPanelPinning(dashboard)!.getOrigin(panel)).toHaveFocus());
  });

  it('restores the original panel on entering edit mode', () => {
    const { panel, dashboard, rerender, tree, onMount } = setup();
    const input = screen.getByRole('textbox', { name: 'Search' });
    act(() => getPanelPinning(dashboard)!.pin(panel));
    expect(screen.getByRole('region', { name: 'Pinned panel' })).toContainElement(input);
    rerender(tree(false));
    expect(screen.getByRole('textbox', { name: 'Search' })).toBe(input);
    expect(getPanelPinning(dashboard)!.canPin(panel)).toBe(false);
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it('clears the dock when its source panel unmounts', () => {
    const { panel, dashboard, rerender, tree } = setup();
    act(() => getPanelPinning(dashboard)!.pin(panel));
    expect(screen.getByRole('region', { name: 'Pinned panel' })).toBeVisible();
    rerender(tree(true, false));
    expect(getPanelPinning(dashboard)!.getSnapshot()).toBeNull();
    expect(screen.queryByRole('region', { name: 'Pinned panel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Search' })).not.toBeInTheDocument();
  });
});
