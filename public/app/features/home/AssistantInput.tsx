import { css } from '@emotion/css';
import { Suspense } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type ComponentTypeWithExtensionMeta } from '@grafana/data';
import { renderLimitedComponents } from '@grafana/runtime';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';

import { HomeSection } from './HomeSection';

/** The Assistant's prompt input as the plugin renders it today; off by a few px at worst, not by the whole card. */
const ASSISTANT_INPUT_HEIGHT = 50;

interface Props {
  components: Array<ComponentTypeWithExtensionMeta<{}>>;
  /** True while the registry loads the plugins declaring this slot; false at once when none do. */
  loading: boolean;
}

/**
 * The Assistant's prompt input on the redesigned homepage. The slot holds the input's height from first paint
 * until the input lands, so the sections below never move: a skeleton while the registry loads the plugin, then
 * a reserved area while the plugin's component settles. The component paints nothing of its own while its chunk
 * and availability check resolve (its own Suspense boundary has no fallback), so the reservation cannot wait on
 * what it paints. The slot is dropped only when the registry settles without an Assistant component, which is
 * how an instance without the Assistant looks. The plugin returns nothing for good only on OSS without accepted
 * terms, outside the redesign's Cloud rollout.
 */
export function AssistantInput({ components, loading }: Props) {
  const content = renderLimitedComponents({ props: {}, limit: 1, components, pluginId: ASSISTANT_PLUGIN_ID });
  if (!loading && content === null) {
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
        {content === null ? skeleton : <Suspense fallback={skeleton}>{content}</Suspense>}
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
