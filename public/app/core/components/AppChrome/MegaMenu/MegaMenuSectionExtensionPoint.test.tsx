import { type JSX } from 'react';
import { render, screen, userEvent } from 'test/test-utils';

import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { setPluginComponentsHook } from '@grafana/runtime';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { type MegaMenuSectionProps, useMegaMenuSectionExtension } from './MegaMenuSectionExtensionPoint';

// `createComponentWithMeta` takes props that share a key with JSX's intrinsic attributes. Partial, as a plugin's section
// runs on Grafana versions that pass more or fewer of them.
type SectionProps = Partial<MegaMenuSectionProps> & JSX.IntrinsicAttributes;

const createSectionComponent = (pluginId: string, title: string): ComponentTypeWithExtensionMeta<SectionProps> =>
  createComponentWithMeta<SectionProps>(
    {
      pluginId,
      title,
      component: ({ onNavigate }) => (
        <button type="button" onClick={onNavigate}>
          {title}
        </button>
      ),
    },
    PluginExtensionPoints.MegaMenuSection
  );

const provideSectionComponents = (components: Array<ComponentTypeWithExtensionMeta<SectionProps>>) =>
  setPluginComponentsHook(({ extensionPointId }) => ({
    isLoading: false,
    components: extensionPointId === PluginExtensionPoints.MegaMenuSection ? components : [],
  }));

function Section(props: MegaMenuSectionProps) {
  const section = useMegaMenuSectionExtension(props);
  return <div data-testid="section">{section ?? 'empty'}</div>;
}

describe('useMegaMenuSectionExtension', () => {
  afterEach(() => {
    setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  });

  it('renders the Assistant section and no other plugin', () => {
    provideSectionComponents([
      createSectionComponent('grafana-untrusted-app', 'Untrusted section'),
      createSectionComponent('grafana-assistant-app', 'Conversations'),
    ]);

    render(<Section collapsed={false} onCollapsedChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Conversations' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Untrusted section' })).not.toBeInTheDocument();
  });

  it('passes onNavigate to the section', async () => {
    provideSectionComponents([createSectionComponent('grafana-assistant-app', 'Conversations')]);
    const onNavigate = jest.fn();

    render(<Section onNavigate={onNavigate} collapsed={false} onCollapsedChange={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Conversations' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('is empty when no plugin fills the section', () => {
    provideSectionComponents([createSectionComponent('grafana-untrusted-app', 'Untrusted section')]);

    render(<Section collapsed={false} onCollapsedChange={jest.fn()} />);

    expect(screen.getByTestId('section')).toHaveTextContent('empty');
  });

  it('passes the folded state, and the call that changes it, to the section', async () => {
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components:
        extensionPointId === PluginExtensionPoints.MegaMenuSection
          ? [
              createComponentWithMeta<SectionProps>(
                {
                  pluginId: 'grafana-assistant-app',
                  title: 'Conversations',
                  component: ({ collapsed, onCollapsedChange }) => (
                    <button type="button" aria-expanded={!collapsed} onClick={() => onCollapsedChange?.(!collapsed)}>
                      Conversations
                    </button>
                  ),
                },
                PluginExtensionPoints.MegaMenuSection
              ),
            ]
          : [],
    }));
    const onCollapsedChange = jest.fn();

    render(<Section collapsed onCollapsedChange={onCollapsedChange} />);
    const toggle = screen.getByRole('button', { name: 'Conversations' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);

    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });
});
