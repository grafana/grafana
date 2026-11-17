import { type JSX } from 'react';
import { render, screen, userEvent } from 'test/test-utils';

import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { setPluginComponentsHook } from '@grafana/runtime';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { type MegaMenuSectionProps, useMegaMenuSectionExtension } from './MegaMenuSectionExtensionPoint';

// `createComponentWithMeta` takes props that share a key with JSX's intrinsic attributes.
type SectionProps = MegaMenuSectionProps & JSX.IntrinsicAttributes;

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

    render(<Section />);

    expect(screen.getByRole('button', { name: 'Conversations' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Untrusted section' })).not.toBeInTheDocument();
  });

  it('passes onNavigate to the section', async () => {
    provideSectionComponents([createSectionComponent('grafana-assistant-app', 'Conversations')]);
    const onNavigate = jest.fn();

    render(<Section onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: 'Conversations' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('is empty when no plugin fills the section', () => {
    provideSectionComponents([createSectionComponent('grafana-untrusted-app', 'Untrusted section')]);

    render(<Section />);

    expect(screen.getByTestId('section')).toHaveTextContent('empty');
  });
});
