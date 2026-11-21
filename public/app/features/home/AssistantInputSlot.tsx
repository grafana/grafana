import { css } from '@emotion/css';
import { Suspense } from 'react';
import Skeleton from 'react-loading-skeleton';

import { PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';

import { PluginSectionFrame } from './PluginSectionFrame';

/** The plugin's prompt input: a 48px input inside a 2px border. */
const ASSISTANT_INPUT_HEIGHT = 52;

/**
 * Holds the input's height while the registry and the component's chunk load, so the sections below never move.
 * From then on the plugin owns the slot: it renders nothing once the Assistant cannot be used, which hides the
 * frame. The slot is dropped outright when the registry settles without an Assistant component.
 */
interface Props {
  /** Off where the slot sits straight on the page, without the homepage section card around it. */
  framed?: boolean;
}

export function AssistantInputSlot({ framed = true }: Props) {
  const { components, isLoading } = usePluginComponents({ extensionPointId: PluginExtensionPoints.HomepageAssistant });
  const content = renderLimitedComponents({ props: {}, limit: 1, components, pluginId: ASSISTANT_PLUGIN_ID });
  if (!isLoading && content === null) {
    return null;
  }
  const skeleton = (
    <Skeleton
      height={ASSISTANT_INPUT_HEIGHT}
      containerClassName={styles.block}
      containerTestId="home-page-assistant-skeleton"
    />
  );
  const slot = <Suspense fallback={skeleton}>{content ?? skeleton}</Suspense>;
  if (!framed) {
    return <div data-testid="home-page-assistant-slot">{slot}</div>;
  }
  return <PluginSectionFrame data-testid="home-page-assistant-slot">{slot}</PluginSectionFrame>;
}

const styles = {
  block: css({
    display: 'block',
  }),
};
