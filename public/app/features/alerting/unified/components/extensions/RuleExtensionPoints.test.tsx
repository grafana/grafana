import { type ComponentType } from 'react';
import { render, screen } from 'test/test-utils';

import { type ComponentTypeWithExtensionMeta, PluginExtensionTypes } from '@grafana/data';
import { setPluginComponentsHook } from '@grafana/runtime';

import { mockGrafanaPromAlertingRule } from '../../mocks';

import {
  AnnotationsAssistantExtensionPoint,
  NotificationPreviewExtensionPoint,
  RuleListItemIndicatorExtensionPoint,
  type RuleListItemIndicatorProps,
} from './RuleExtensionPoints';

function withMeta<Props extends object>(
  Component: ComponentType<Props>,
  id: string
): ComponentTypeWithExtensionMeta<Props> {
  return Object.assign(Component, {
    meta: { pluginId: 'grafana', title: id, description: '', id, type: PluginExtensionTypes.component as const },
  });
}

function setRegisteredComponents<Props extends object>(components: Array<ComponentTypeWithExtensionMeta<Props>>) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  setPluginComponentsHook(() => ({ components: components as Array<ComponentTypeWithExtensionMeta<{}>>, isLoading: false }));
}

describe('RuleExtensionPoints', () => {
  beforeEach(() => {
    setRegisteredComponents([]);
  });

  it('renders nothing when no extensions are registered', () => {
    const { container } = render(
      <>
        <AnnotationsAssistantExtensionPoint />
        <NotificationPreviewExtensionPoint />
        <RuleListItemIndicatorExtensionPoint rule={mockGrafanaPromAlertingRule()} />
      </>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders registered components', () => {
    setRegisteredComponents([withMeta(() => <div>annotations assistant</div>, 'assistant-1')]);

    render(<AnnotationsAssistantExtensionPoint />);

    expect(screen.getByText('annotations assistant')).toBeInTheDocument();
  });

  it('passes the rule to registered rule list indicators', () => {
    const rule = mockGrafanaPromAlertingRule({ name: 'my-rule' });
    setRegisteredComponents([
      withMeta<RuleListItemIndicatorProps>(({ rule }) => <div>indicator for {rule.name}</div>, 'indicator-1'),
    ]);

    render(<RuleListItemIndicatorExtensionPoint rule={rule} />);

    expect(screen.getByText('indicator for my-rule')).toBeInTheDocument();
  });
});
