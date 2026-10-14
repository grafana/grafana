import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { useFlagGrafanaNotebookComposer } from '@grafana/runtime/internal';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { AssistantSparkleGradient } from 'app/core/components/AppChrome/FullscreenWorkspace/AssistantToolbarButtons';
import { useAssistantComposerEntry } from 'app/features/dashboard-scene/composer/useAssistantComposerEntry';

import { useIsNotebookEmbedded } from '../scene/NotebookEmbeddedContext';
import { type NotebookScene } from '../scene/NotebookScene';

import { canEnterNotebookComposer } from './notebookComposerAccess';

const ICON_GRADIENT_ID = 'grafana-assistant-notebook-composer-icon-gradient';

/**
 * The notebook's way into Composer, as the dashboard mode picker's Composer item is: it asks Assistant to
 * enter, and Assistant calls `composer.enter` as usual. Offered only on the notebook's own route, while the
 * flag is on, Assistant has registered and Composer can start. While Composer is open it shows so, and
 * leaves it.
 */
export function NotebookComposerToggle({ scene }: { scene: NotebookScene }) {
  const styles = useStyles2(getStyles);
  // Read for its re-render: canEnterNotebookComposer reads the flag itself.
  useFlagGrafanaNotebookComposer();
  const { isComposing, uid } = scene.useState();
  const embedded = useIsNotebookEmbedded();
  const entry = useAssistantComposerEntry();

  if (embedded) {
    return null;
  }
  if (isComposing) {
    return (
      <>
        <AssistantSparkleGradient id={ICON_GRADIENT_ID} />
        <ToolbarButton
          variant="active"
          icon="ai-sparkle"
          className={styles.assistantIcon}
          aria-label={t('notebook.composer.toggle', 'Composer')}
          aria-pressed
          tooltip={t('notebook.composer.toggle-leave', 'Leave Composer')}
          onClick={() => scene.getComposerSession()?.exit()}
        >
          {t('notebook.composer.toggle', 'Composer')}
        </ToolbarButton>
      </>
    );
  }
  if (!entry || !uid || !canEnterNotebookComposer(scene, { onRoute: true }).ok) {
    return null;
  }
  return (
    <>
      <AssistantSparkleGradient id={ICON_GRADIENT_ID} />
      <ToolbarButton
        variant="canvas"
        icon="ai-sparkle"
        className={styles.assistantIcon}
        aria-label={t('notebook.composer.toggle', 'Composer')}
        aria-pressed={false}
        tooltip={t('notebook.composer.toggle-enter', 'Point at blocks and regions and ask Assistant to change them')}
        onClick={() => entry.request({ resource: 'notebook', uid })}
      >
        {t('notebook.composer.toggle', 'Composer')}
      </ToolbarButton>
    </>
  );
}

const getStyles = () => ({
  // The Assistant sparkle in the Chat button's colours, as in the dashboard mode picker.
  assistantIcon: css({
    '& svg': { opacity: 1 },
    '& svg path': {
      fill: `url(#${ICON_GRADIENT_ID})`,
      stroke: `url(#${ICON_GRADIENT_ID})`,
    },
  }),
});
