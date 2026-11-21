import { css } from '@emotion/css';
import { type FocusEvent, lazy, Suspense, useMemo, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { type Options } from 'app/plugins/panel/text/panelcfg.gen';
import { type TextNGEditorChange } from 'app/plugins/panel/text/v2/editor/TextNGEditor';
import { applyEditorChange } from 'app/plugins/panel/text/v2/utils';
import { getTextVariableSuggestions } from 'app/plugins/panel/text/v2/variableSuggestions';

import { changePanelOptions, previewPanelOptions } from '../../actions/panel/changePanelOptions';

const TextNGEditor = lazy(() =>
  import('app/plugins/panel/text/v2/editor/TextNGEditor').then((m) => ({ default: m.TextNGEditor }))
);

const noop = () => {};

// Only rendered for a loaded text panel, whose options the plugin has completed with its defaults
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const getOptions = (panel: VizPanel) => panel.state.options as Options;

/**
 * The new text panel's own editor, which it normally shows inside the panel in the panel editor.
 * Writing only: the panel on the canvas already shows the result.
 */
export function TextNGSidebarEditor({ panel }: { panel: VizPanel }) {
  const styles = useStyles2(getStyles);
  panel.useState();
  const options = getOptions(panel);
  const { data } = sceneGraph.getData(panel).useState();
  const series = useMemo(() => data?.series ?? [], [data]);
  const suggestions = useMemo(
    () => getTextVariableSuggestions(series, options.renderMode),
    [series, options.renderMode]
  );

  // Content goes to the panel as it is typed, and becomes one undoable edit when focus leaves the editor.
  const optionsBeforeTyping = useRef<Options | undefined>(undefined);
  const category = t('dashboard.sidebar.viz-panel.text-editor.category', 'Text');

  const commitTyping = () => {
    const previousOptions = optionsBeforeTyping.current;
    optionsBeforeTyping.current = undefined;
    if (previousOptions) {
      changePanelOptions(
        panel,
        panel.state.options,
        t('dashboard.sidebar.viz-panel.text-editor.content', 'Content'),
        category,
        previousOptions
      );
    }
  };

  const onChange = (change: TextNGEditorChange) => {
    const current = getOptions(panel);
    const next = applyEditorChange(current, change);
    const isContentOnly =
      change.mode === undefined && change.codeLanguage === undefined && change.showLineNumbers === undefined;

    if (isContentOnly) {
      optionsBeforeTyping.current ??= current;
      previewPanelOptions(panel, next);
      return;
    }

    commitTyping();
    const name =
      change.showLineNumbers !== undefined
        ? t('dashboard.sidebar.viz-panel.text-editor.line-numbers', 'Line numbers')
        : t('dashboard.sidebar.viz-panel.text-editor.mode', 'Mode');
    changePanelOptions(panel, next, name, category);
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      commitTyping();
    }
  };

  return (
    <div className={styles.editor} onBlur={onBlur}>
      <Suspense
        fallback={<LoadingPlaceholder text={t('dashboard.sidebar.viz-panel.text-editor.loading', 'Loading')} />}
      >
        <TextNGEditor
          content={options.content ?? ''}
          mode={options.mode}
          showLineNumbers={options.code?.showLineNumbers ?? false}
          codeLanguage={options.code?.language}
          renderMode={options.renderMode}
          series={series}
          replaceVariables={panel.interpolate}
          suggestions={suggestions}
          onChange={onChange}
          view="write"
          onViewChange={noop}
          showViewToggle={false}
          modePickerPlacement="above"
          hasTitle
        />
      </Suspense>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The editor fills its container, so the container sets the height.
  editor: css({
    height: 400,
    marginBottom: theme.spacing(1),
  }),
});
