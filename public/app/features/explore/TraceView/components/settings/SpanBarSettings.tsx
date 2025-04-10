import { css } from '@emotion/css';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme2,
  toOption,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { ConfigDescriptionLink, ConfigSubSection } from '@grafana/plugin-ui';
import { InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export interface SpanBarOptions {
  type?: string;
  tag?: string;
}

export interface SpanBarOptionsData extends DataSourceJsonData {
  spanBar?: SpanBarOptions;
}

export const NONE = 'None';
export const DURATION = 'Duration';
export const TAG = 'Tag';

interface Props extends DataSourcePluginOptionsEditorProps<SpanBarOptionsData> {}

export default function SpanBarSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);
  const selectOptions = [NONE, DURATION, TAG].map(toOption);

  return (
    <div className={css({ width: '100%' })}>
      <InlineFieldRow className={styles.row}>
        <InlineField
          label={t('explore.span-bar-settings.label-label', 'Label')}
          labelWidth={26}
          tooltip={t('explore.span-bar-settings.tooltip-default-duration', 'Default: duration')}
          grow
        >
          <Select
            inputId="label"
            options={selectOptions}
            value={options.jsonData.spanBar?.type || ''}
            onChange={(v) => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'spanBar', {
                ...options.jsonData.spanBar,
                type: v?.value ?? '',
              });
            }}
            placeholder={t('explore.span-bar-settings.placeholder-duration', 'Duration')}
            isClearable
            aria-label={t('explore.span-bar-settings.aria-label-selectlabelname', 'Select label name')}
            width={40}
          />
        </InlineField>
      </InlineFieldRow>
      {options.jsonData.spanBar?.type === TAG && (
        <InlineFieldRow className={styles.row}>
          <InlineField
            label={t('explore.span-bar-settings.label-tag-key', 'Tag key')}
            labelWidth={26}
            tooltip="Tag key which will be used to get the tag value. A span's attributes and resources will be searched for the tag key"
          >
            <Input
              type="text"
              placeholder={t('explore.span-bar-settings.placeholder-enter-tag-key', 'Enter tag key')}
              onChange={(v) =>
                updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'spanBar', {
                  ...options.jsonData.spanBar,
                  tag: v.currentTarget.value,
                })
              }
              value={options.jsonData.spanBar?.tag || ''}
              width={40}
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
}

export const SpanBarSection = ({ options, onOptionsChange }: DataSourcePluginOptionsEditorProps) => {
  let suffix = options.type;
  suffix += options.type === 'tempo' ? '/configure-tempo-data-source/#span-bar' : '/#span-bar';

  return (
    <ConfigSubSection
      title={t('explore.span-bar-section.title-span-bar', 'Span bar')}
      description={
        <ConfigDescriptionLink
          description="Add additional info next to the service and operation on a span bar row in the trace view."
          suffix={suffix}
          feature="the span bar"
        />
      }
    >
      <SpanBarSettings options={options} onOptionsChange={onOptionsChange} />
    </ConfigSubSection>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  infoText: css({
    label: 'infoText',
    paddingBottom: theme.spacing(2),
    color: theme.colors.text.secondary,
  }),
  row: css({
    label: 'row',
    alignItems: 'baseline',
  }),
});
