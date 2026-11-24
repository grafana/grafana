import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { RadioButtonGroup } from '@grafana/ui';

import { type Options, TextMode, TextStyle } from './panelcfg.gen';

/**
 * Opt-in prose style for markdown, shared with report section summaries. Authoring is gated;
 * a panel that already uses the style keeps the option so it can be switched back.
 */
export function addTextStyleOption(builder: PanelOptionsEditorBuilder<Options>, category: string[]) {
  builder.addCustomEditor<{}, TextStyle | undefined>({
    id: 'textStyle',
    path: 'textStyle',
    name: t('text.name-text-style', 'Style'),
    description: t(
      'text.text-style-description',
      'Editorial sets markdown in the same serif prose as report section summaries.'
    ),
    category,
    // No default: an untouched panel must not gain the option when its dashboard is saved.
    editor: ({ value, onChange }) => (
      <RadioButtonGroup
        value={value ?? TextStyle.Default}
        options={[
          { value: TextStyle.Default, label: t('text.text-style-options.label-default', 'Default') },
          { value: TextStyle.Editorial, label: t('text.text-style-options.label-editorial', 'Editorial') },
        ]}
        onChange={(next) => onChange(next === TextStyle.Editorial ? next : undefined)}
      />
    ),
    showIf: (options) =>
      options.mode === TextMode.Markdown &&
      (options.textStyle === TextStyle.Editorial ||
        getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardsReportLayouts, false)),
  });
}
