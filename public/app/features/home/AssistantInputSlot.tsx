import { css } from '@emotion/css';
import { Suspense } from 'react';
import Skeleton from 'react-loading-skeleton';

import { PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';

import { HomeSection } from './HomeSection';

/** The Assistant's prompt input as the plugin renders it today; off by a few px at worst, not by the whole card. */
const ASSISTANT_INPUT_HEIGHT = 50;

/**
 * Holds the Assistant's prompt input slot on the redesigned homepage at the input's height from first paint until
 * the input lands, so the sections below never move: a skeleton while the registry loads the plugin and while the
 * component's chunk loads, then a bare reserved area while the plugin's component settles. That last reservation
 * compensates for the plugin: its own Suspense boundary has no fallback, so the component paints nothing while its
 * availability check resolves, and the host cannot tell "still resolving" from "settled on nothing". A plugin that
 * settles on nothing (OSS without accepted terms) therefore leaves an empty slot; the fix for that belongs in the
 * plugin. The slot is dropped only when the registry settles without an Assistant component: an instance without
 * the Assistant.
 */
export function AssistantInputSlot() {
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
  return (
    <HomeSection>
      <div className={styles.reserved} data-testid="home-page-assistant-slot">
        <Suspense fallback={skeleton}>{content ?? skeleton}</Suspense>
      </div>
    </HomeSection>
  );
}

const styles = {
  block: css({
    display: 'block',
  }),
  reserved: css({
    minHeight: ASSISTANT_INPUT_HEIGHT,
  }),
};
