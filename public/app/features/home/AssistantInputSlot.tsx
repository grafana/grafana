import { css } from '@emotion/css';
import { Suspense } from 'react';
import Skeleton from 'react-loading-skeleton';

import { PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';

import { HomeSection } from './HomeSection';

/** The plugin's prompt input: a 48px input inside a 2px border. */
const ASSISTANT_INPUT_HEIGHT = 52;

/**
 * Holds the input's height from first paint so the sections below never move: a skeleton while the registry and
 * the component's chunk load, then a reserved area while the plugin resolves availability without painting. The
 * host cannot tell resolving from settled-on-nothing, so an unavailable Assistant (OSS without accepted terms)
 * keeps an empty slot; only an instance with no Assistant registered drops it.
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
