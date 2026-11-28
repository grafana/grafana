import { debounce } from 'lodash';
import { useEffect, useMemo } from 'react';

import { getReportableOptionValue } from 'app/features/dashboard/components/PanelEditor/getReportableOptionValue';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { CodeLanguage, type Options, TextMode } from '../../panelcfg.gen';

import { type TextNGEditorChange } from './TextNGEditor';

const CONTENT_REPORT_DEBOUNCE_MS = 2000;

const choicesOf = (values: string[]) => ({ options: values.map((value) => ({ value })) });
const MODE_CHOICES = choicesOf(Object.values(TextMode));
const LANGUAGE_CHOICES = choicesOf(Object.values(CodeLanguage));

type TextEditorOption = 'content' | 'mode' | 'code.language' | 'code.showLineNumbers';

/**
 * The options an editor change sets differently from the current ones. The Text panel's editor writes its options
 * directly, so these changes never reach the options pane's reporting.
 */
export function getChangedTextEditorOptions(
  options: Options,
  change: TextNGEditorChange
): Array<{ option: TextEditorOption; value: unknown; settings?: unknown }> {
  const changed: Array<{ option: TextEditorOption; value: unknown; settings?: unknown }> = [];

  if (change.content !== (options.content ?? '')) {
    changed.push({ option: 'content', value: change.content });
  }
  if (change.mode !== undefined && change.mode !== options.mode) {
    changed.push({ option: 'mode', value: change.mode, settings: MODE_CHOICES });
  }
  if (change.codeLanguage !== undefined && change.codeLanguage !== options.code?.language) {
    changed.push({ option: 'code.language', value: change.codeLanguage, settings: LANGUAGE_CHOICES });
  }
  if (change.showLineNumbers !== undefined && change.showLineNumbers !== (options.code?.showLineNumbers ?? false)) {
    changed.push({ option: 'code.showLineNumbers', value: change.showLineNumbers });
  }

  return changed;
}

/**
 * Reports the Text panel editor's changes on dashboards_set_visualization_option. Content is never sent (only that it
 * changed), and since the editor commits content after every short pause, content reports are debounced.
 */
export function useTextEditorChangeReporter(panelId: number) {
  const reportContent = useMemo(
    () =>
      debounce(
        () =>
          DashboardInteractions.setVisualOption({
            ui: 'text-panel-editor',
            option: 'content',
            value_type: 'string',
            panel_type: 'text',
            panel_id: panelId,
          }),
        CONTENT_REPORT_DEBOUNCE_MS
      ),
    [panelId]
  );

  useEffect(() => () => reportContent.flush(), [reportContent]);

  return (options: Options, change: TextNGEditorChange) => {
    for (const { option, value, settings } of getChangedTextEditorOptions(options, change)) {
      if (option === 'content') {
        reportContent();
        continue;
      }
      DashboardInteractions.setVisualOption({
        ui: 'text-panel-editor',
        option,
        ...getReportableOptionValue(value, settings),
        panel_type: 'text',
        panel_id: panelId,
      });
    }
  };
}
